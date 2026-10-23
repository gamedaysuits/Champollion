"""
COMET metric integration — neural MT quality estimation.

────────────────────────────────────────────────────────────────────
WHAT COMET IS
────────────────────────────────────────────────────────────────────

COMET (Crosslingual Optimized Metric for Evaluation of Translation)
is a learned metric from Unbabel that uses multilingual embeddings
(XLM-R) trained on human quality judgments from WMT shared tasks.

Unlike lexical metrics (chrF++, BLEU) which measure surface overlap,
COMET captures semantic similarity. A translation that paraphrases
correctly scores high on COMET even if it shares few n-grams with
the reference. Since WMT 2022, COMET has been the primary automatic
metric for system-level evaluation.

MODEL CHOICE: Unbabel/wmt22-comet-da
────────────────────────────────────────────────────────────────────
- WMT 2022 winning reference-based model
- Scores scaled 0.0–1.0 for easy interpretation
- ~2.3 GB checkpoint download on first use
- Runs on CPU (slower) or GPU (faster)
- Well-tested, stable, widely cited in MT literature

We use wmt22-comet-da rather than the newer XCOMET-XXL because:
  1. wmt22 is the community standard baseline (apples-to-apples)
  2. XCOMET-XXL requires significantly more GPU memory
  3. wmt22 is sufficient for system-level ranking

Users can override the model via --comet-model flag.

LOW-RESOURCE LANGUAGE NOTE:
────────────────────────────────────────────────────────────────────
COMET's XLM-R backbone was trained on 100 languages. For languages
well-represented in the XLM-R training data (French, German, etc.),
COMET correlates very well with human judgments.

For truly low-resource languages like Plains Cree (crk), COMET scores
are LESS RELIABLE because:
  - XLM-R has minimal Cree training data
  - No Cree-specific human judgments in COMET training
  - Embeddings for Cree text may not capture semantic meaning well

We still compute COMET for low-resource pairs because:
  - The score is informative as a RELATIVE ranking signal between runs
  - Even noisy COMET correlates better with quality than chrF++ alone
  - The user should interpret low-resource COMET with wider error bars

The module logs a clear note when the target language is not in
XLM-R's top-supported tier.

REFERENCES:
  - Rei et al. (2022). "COMET-22: Unbabel-IST 2022 Submission for
    the Metrics Shared Task." WMT 2022.
  - Rei et al. (2020). "COMET: A Neural Framework for MT Evaluation."
    EMNLP 2020.
  - WMT 2024 Findings: COMET as primary automatic metric for
    system-level evaluation.
────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

# COMET is the optional `comet` extra (unbabel-comet + PyTorch). Two facts
# about the upstream package, measured 2026-09-28 on unbabel-comet 2.2.7 (the
# latest on PyPI, which declares requires_python >=3.8):
#   * it pins torchmetrics < 0.11, and torchmetrics 0.10 imports
#     `pkg_resources`, which setuptools >= 81 no longer ships — so a fresh
#     install could not import COMET at all. The extra pins setuptools < 81.
#   * it imports functools._HashedSeq, which Python 3.14 removed — so it cannot
#     run on 3.14 whatever is pinned. Use a 3.12 or 3.13 environment for COMET.
COMET_PIP_SPECS: tuple[str, ...] = ("unbabel-comet>=2.2", "setuptools<81")
COMET_MAX_PYTHON = (3, 14)   # exclusive


def comet_python_blocker() -> str | None:
    """Why COMET cannot run on this interpreter, or None."""
    if sys.version_info[:2] >= COMET_MAX_PYTHON:
        return (f"unbabel-comet (2.2.7, the latest release) imports "
                f"functools._HashedSeq, which Python "
                f"{COMET_MAX_PYTHON[0]}.{COMET_MAX_PYTHON[1]} removed; this is "
                f"Python {sys.version.split()[0]}. Run COMET from a Python 3.12 "
                f"or 3.13 environment (the organizer node is 3.12).")
    return None


try:
    from comet import download_model, load_from_checkpoint
    HAS_COMET = True
    COMET_IMPORT_ERROR: str | None = None
except ImportError as _exc:
    HAS_COMET = False
    COMET_IMPORT_ERROR = f"{type(_exc).__name__}: {_exc}"


def comet_unavailable_reason() -> str | None:
    """Why this interpreter computes no COMET score, in one clause with the
    way out — or None when COMET imports. The one wording the test summary,
    the report's ``metric_availability`` and the run card's COMET row use
    (the card used to show no COMET row at all, and the only notice was a
    log line an MCP status trim cut — synthetic researcher, Round 8)."""
    if HAS_COMET:
        return None
    blocker = comet_python_blocker()
    if blocker:
        return blocker.rstrip(".")
    if COMET_IMPORT_ERROR and "No module named 'comet'" not in COMET_IMPORT_ERROR:
        return (f"unbabel-comet is installed but does not import "
                f"({COMET_IMPORT_ERROR}) — `mt-eval setup --status` says why")
    return "unbabel-comet is not installed — mt-eval setup --comet"


# Default model — community standard since WMT 2022
DEFAULT_COMET_MODEL = "Unbabel/wmt22-comet-da"

# XLM-R high-resource and AfriCOMET data now live on the language cards
# (metricModelSupport field), queried through language_cards.py.
# See: enrich-metric-model-support.mjs for how cards are enriched.
from mt_eval_harness.language_cards import (
    is_xlmr_high_resource as _is_xlmr_high_resource,
    has_africomet as _has_africomet,
    get_metric_model_for as _get_metric_model_for,
)


# ── Language-Aware Model Selection ───────────────────────────────
#
# Model selection is now driven by language cards' metricModelSupport
# field. Each card knows which COMET model variant is best for it.
# This replaced the hardcoded COMET_MODEL_REGISTRY and
# _AFRICOMET_LANGUAGES set.
#
# References:
#   AfriCOMET: Wan et al. (2022), Masakhane community
#   XLM-R: Conneau et al. (2020)


def resolve_comet_model(
    target_lang: str = "",
    explicit_model: str | None = None,
) -> str:
    """Resolve the best COMET model for the given target language.

    Priority order:
        1. Explicit CLI override (--comet-model flag) — always wins
        2. Language card metricModelSupport recommendation
        3. DEFAULT_COMET_MODEL fallback

    Data source: language card metricModelSupport field (SSOT).

    Args:
        target_lang: ISO 639-3 or BCP-47 code for the target language.
        explicit_model: If set, this model is used unconditionally
                        (user explicitly chose a model via --comet-model).

    Returns:
        COMET model identifier string (e.g., "Unbabel/wmt22-comet-da"
        or "masakhane/africomet-mtl").
    """
    # 1. Explicit override always wins
    if explicit_model:
        return explicit_model

    # 2. Check language card for specialized model recommendation
    lang_base = target_lang.split("-")[0].lower() if target_lang else ""
    if lang_base:
        recommended = _get_metric_model_for(lang_base)
        if recommended:
            print(
                f"  COMET: Auto-selecting specialized model "
                f"({recommended}) for {target_lang}"
            )
            return recommended

    # 3. Default fallback
    return DEFAULT_COMET_MODEL


@dataclass
class COMETResult:
    """Result of COMET scoring for a single run.

    corpus_score is the mean of per-segment scores, which is the
    standard COMET aggregation method.
    """
    corpus_score: float              # Mean of per-segment scores (0.0–1.0)
    # ALIGNED to the entries passed in: per_entry_scores[i] belongs to
    # entries[i], None where entry i was not scorable (an errored entry, or
    # no source / reference). Callers index by position — never re-count.
    per_entry_scores: list[float | None]
    model_name: str                  # Which COMET model was used
    n_entries: int                   # Number of entries scored
    target_lang: str                 # Target language code
    low_resource_warning: bool       # True if target lang not in XLM-R top tier


# Module-level cache for the loaded model. Loading the model checkpoint
# takes ~5-10 seconds and ~2.3 GB memory; we don't want to reload it
# for every call within the same process.
_cached_model = None
_cached_model_name = None


def _load_model(model_name: str = DEFAULT_COMET_MODEL):
    """Load a COMET model, using a module-level cache.

    Downloads the model checkpoint on first use (~2.3 GB for wmt22-comet-da).
    Subsequent calls with the same model_name return the cached instance.
    """
    global _cached_model, _cached_model_name

    # Check cache FIRST — if the model is already loaded, return it
    # immediately without requiring the comet import to succeed.
    # This also enables test mocking without having comet installed.
    if _cached_model is not None and _cached_model_name == model_name:
        return _cached_model

    if not HAS_COMET:
        raise RuntimeError(
            "COMET is not available. Install it with:\n"
            "  mt-eval setup --comet\n"
            "(or: python3 -m pip install 'mt-eval-harness[comet]')"
        )

    print(f"  Loading COMET model: {model_name}")
    print(f"  (First run downloads ~2.3 GB checkpoint)")
    model_path = download_model(model_name)
    _cached_model = load_from_checkpoint(model_path)
    _cached_model_name = model_name
    print(f"  COMET model loaded: {model_name}")

    return _cached_model


def _predict_kwargs() -> dict:
    """Extra arguments COMET's predict() needs on this machine.

    unbabel-comet 2.2.7 hands the DataLoader multiprocessing_context="fork"
    whenever Apple's MPS backend exists, but with gpus=0 it also picks
    num_workers=0, and torch refuses a multiprocessing context with no worker
    processes (ValueError) — so COMET could not score anything on an Apple
    Silicon Mac. One worker satisfies the combination COMET itself asked for.
    Linux (the organizer node) has no MPS and is unaffected.
    """
    try:
        import torch
        if torch.backends.mps.is_available():
            return {"num_workers": 1}
    except Exception:  # torch absent or too old to report MPS: nothing to add
        pass
    return {}


def scorable_indices(entries: list[dict], *, need_reference: bool) -> list[int]:
    """Indices of the entries a neural metric scores — the same population
    chrF++/BLEU score (tester.py: every non-error entry).

    An EMPTY PREDICTION IS SCORED, as an empty hypothesis: a system that outputs
    nothing for a segment is penalized on that segment. Dropping it (the
    pre-0.2 behaviour) raised the corpus mean for exactly the systems that
    failed to translate, and shifted every later per-entry score onto the wrong
    entry. Excluded: errored entries (counted as errors, as for chrF++), and
    entries with no source or — for reference-based metrics — no reference,
    which a neural metric cannot score at all.
    """
    return [
        i for i, e in enumerate(entries)
        if not e.get("error")
        and (e.get("source") or "").strip()
        and (not need_reference or (e.get("expected") or "").strip())
    ]


def aligned(n: int, indices: list[int], scores: list[float]) -> list[float | None]:
    """Spread ``scores`` (one per scored index) back over ``n`` entries."""
    if len(scores) != len(indices):
        raise ValueError(
            f"metric returned {len(scores)} scores for {len(indices)} inputs")
    out: list[float | None] = [None] * n
    for i, score in zip(indices, scores):
        out[i] = round(float(score), 4)
    return out


def compute_comet(
    entries: list[dict],
    target_lang: str = "",
    model_name: str = DEFAULT_COMET_MODEL,
    gpus: int = 0,
) -> COMETResult | None:
    """Compute COMET scores for a list of entry dicts.

    Requires entries to have 'source', 'expected' (reference), and
    'predicted' (hypothesis) fields — the same schema used by tester.py.

    Args:
        entries: Per-entry result dicts from TestReport. Errored entries and
                 entries with no source/reference are not scored; an EMPTY
                 prediction is scored as an empty hypothesis (see
                 scorable_indices).
        target_lang: BCP-47 code for the target language (e.g., 'fr', 'crk').
                     Used to check XLM-R coverage and emit warnings.
        model_name: COMET model identifier. Default: wmt22-comet-da.
        gpus: Number of GPUs to use. 0 = CPU inference (slower but no GPU needed).

    Returns:
        COMETResult with corpus and per-entry scores,
        or None if COMET is not installed.
    """
    if not HAS_COMET:
        return None

    indices = scorable_indices(entries, need_reference=True)
    valid = [entries[i] for i in indices]

    if not valid:
        print("  COMET: No valid entries to score (all errors or empty)")
        return None

    # Check for low-resource language — queries language card SSOT
    # (metricModelSupport.xlmr.tier). Handles both 639-1 and 639-3.
    lang_base = target_lang.split("-")[0].lower() if target_lang else ""
    is_low_resource = bool(lang_base) and not _is_xlmr_high_resource(lang_base)

    if is_low_resource:
        print(
            f"  ⚠️  COMET note: '{target_lang}' is not in XLM-R's high-resource tier.\n"
            f"     Scores are still computed but may be less reliable for this language.\n"
            f"     Use COMET scores as a relative ranking signal, not an absolute measure."
        )

    # Build COMET input format: list of dicts with src, mt, ref
    comet_data = [
        {
            "src": e["source"],
            "mt": e.get("predicted") or "",
            "ref": e["expected"],
        }
        for e in valid
    ]

    # Load model (cached after first call)
    model = _load_model(model_name)

    # Run inference
    # gpus=0 → CPU; gpus=1 → single GPU
    print(f"  COMET: Scoring {len(comet_data)} entries ({model_name})...")
    output = model.predict(comet_data, gpus=gpus, **_predict_kwargs())

    # COMET output structure: output.scores (list), output.system_score (float)
    corpus_score = output.system_score

    print(f"  COMET score: {corpus_score:.4f}")

    return COMETResult(
        corpus_score=round(corpus_score, 4),
        per_entry_scores=aligned(len(entries), indices, list(output.scores)),
        model_name=model_name,
        n_entries=len(valid),
        target_lang=target_lang,
        low_resource_warning=is_low_resource,
    )


def corpus_comet(entries: list[dict]) -> float | None:
    """Metric function compatible with significance.py / confidence.py.

    Computes COMET corpus score from entries. Used as a metric_fn
    for paired_bootstrap() and bootstrap_ci().

    Returns None — NOT 0.0 — when COMET is unavailable or there are no
    valid entries to score. 0.0 is a legitimate (worst) system score, so
    collapsing "metric absent" into 0.0 would let an un-scored run masquerade
    as a genuinely zero-quality one in any aggregation/bootstrap path. Mirrors
    compute_qe()'s None contract so callers can tell "no score" from "scored 0"
    and skip the metric instead of averaging in a phantom zero.

    NOTE: This function loads and caches the COMET model on first call.
    Subsequent calls reuse the cached model. This makes bootstrap
    resampling feasible (model loads once, scores B times).
    """
    if not HAS_COMET:
        return None

    valid = [entries[i] for i in scorable_indices(entries, need_reference=True)]

    if not valid:
        return None

    comet_data = [
        {"src": e["source"], "mt": e.get("predicted") or "", "ref": e["expected"]}
        for e in valid
    ]

    model = _load_model()
    output = model.predict(comet_data, gpus=0, progress_bar=False, **_predict_kwargs())
    return output.system_score


# ── Reference-free Quality Estimation (QE) ──────────────────────────────────
# QE models (e.g. masakhane/africomet-qe-stl) score adequacy from SOURCE + MT
# only — NO reference. The no-reference profile uses this for runs/languages
# without gold references. Loaded the same way as reference-based COMET.

def resolve_qe_model(target_lang: str = "", explicit_model: str | None = None) -> str | None:
    """Resolve the reference-free QE model for a language (card SSOT).

    Priority: explicit override > card metricModelSupport.qe.model > None.
    Returns None when no QE model is declared. The no-reference profile then
    scores from its deterministic signals alone (test-pinned decision:
    test_scoring_ssot.TestNoReferenceDeterministic — it does NOT fail loud),
    and tester.py prints a loud adequacy-free warning: without qe_score that
    composite measures structural validity + behavioral hygiene only.
    """
    if explicit_model:
        return explicit_model
    lang_base = target_lang.split("-")[0].lower() if target_lang else ""
    if not lang_base:
        return None
    from mt_eval_harness.language_cards import get_qe_model_for
    return get_qe_model_for(lang_base)


def compute_qe(
    entries: list[dict],
    target_lang: str = "",
    model_name: str | None = None,
    gpus: int = 0,
) -> COMETResult | None:
    """Compute reference-FREE QE scores (source + MT, NO reference).

    Requires entries with 'source' and 'predicted'. Returns a COMETResult
    (low_resource_warning=False) or None when QE is unavailable / no model is
    given / no valid entries. The caller decides whether None is fatal — the
    no-reference profile REQUIRES qe_score and so fails loud on None.
    """
    if not HAS_COMET or not model_name:
        return None

    indices = scorable_indices(entries, need_reference=False)
    valid = [entries[i] for i in indices]
    if not valid:
        return None

    qe_data = [{"src": e["source"], "mt": e.get("predicted") or ""} for e in valid]
    model = _load_model(model_name)
    print(f"  QE: Scoring {len(qe_data)} entries ({model_name}, reference-free)…")
    output = model.predict(qe_data, gpus=gpus, **_predict_kwargs())
    return COMETResult(
        corpus_score=round(output.system_score, 4),
        per_entry_scores=aligned(len(entries), indices, list(output.scores)),
        model_name=model_name,
        n_entries=len(valid),
        target_lang=target_lang,
        low_resource_warning=False,
    )
