"""MetricX-24 integration — learned neural MT metric (Google, Apache-2.0).

────────────────────────────────────────────────────────────────────
WHAT MetricX IS
────────────────────────────────────────────────────────────────────

MetricX (Juraska et al., Google) is a learned MT metric built on an
mT5 backbone and fine-tuned to predict human MQM error scores. MetricX-24
(the `*-hybrid-*-v2p6` checkpoints) TOPPED the WMT24 Metrics shared task and
is the reference metric that WMT24++ and TranslateGemma report against — so
adding it gives us apples-to-apples comparability with essentially every
2024–2026 frontier MT paper.

DIRECTION — LOWER IS BETTER:
────────────────────────────────────────────────────────────────────
MetricX predicts an ERROR magnitude, not a quality score. The model output
is clipped to [0, 25] where **0 = perfect** and **25 = worst**. This is the
OPPOSITE of COMET / chrF++ (higher = better). We carry that direction
explicitly through storage and display (``lower_is_better=True``) so a
MetricX score is never silently sorted or compared as if higher were better.
See ``METRICX_LOWER_IS_BETTER``.

NEURAL LANE — NEVER IN THE COMPOSITE:
────────────────────────────────────────────────────────────────────
Like COMET/AfriCOMET, MetricX is a model-dependent neural metric. The
deterministic composite is reproducible by the verifier from the corpus
alone; MetricX is not. So ``metricx_score`` is listed in
``scoring.NEURAL_METRICS`` and is computed, stored, and surfaced on its OWN —
never folded into any composite weight table (by design: "deterministic composite; neural reported separately").

MODEL CHOICE: google/metricx-24-hybrid-large-v2p6
────────────────────────────────────────────────────────────────────
We default to the "large" hybrid checkpoint for the same reason COMET
defaults to wmt22-comet-da over XCOMET-XXL: it is the most accessible
variant (runs on CPU / a modest GPU) and is sufficient for system-level
ranking. The `xl` / `xxl` checkpoints correlate better but need far more
memory. Override via ``--metricx-model`` (or ``config.metricx_model``).

The hybrid checkpoints are "hybrid" because the same model does both
reference-based scoring and reference-free QE — we use the reference-based
mode by default (what WMT24++ reports) and fall back to QE when a run has no
references. All MetricX-24 checkpoints share the mT5-XL tokenizer.

LOW-RESOURCE LANGUAGE NOTE:
────────────────────────────────────────────────────────────────────
MetricX's mT5 backbone, like COMET's XLM-R, covers ~100 languages. For truly
low-resource targets (e.g. Plains Cree, crk) the score is LESS reliable — the
backbone has little to no training signal for the language. We still compute
it as a RELATIVE ranking signal and emit a clear note, querying the same
language-card SSOT (``metricModelSupport.xlmr.tier``) COMET uses.

MetricX-25:
────────────────────────────────────────────────────────────────────
MetricX-25 (Juraska et al., arXiv 2510.24707) is the newer generation. Its
input format and lower-is-better direction are unchanged, so this module
scores it too: install the `metricx25` package and pass a
``google/metricx-25-*`` checkpoint via ``--metricx-model``. The import guard
below tries ``metricx24`` first, then ``metricx25`` (Google has kept the
``MT5ForRegression`` class name stable across generations).

OPTIONAL DEPENDENCY (the `metricx` extra):
────────────────────────────────────────────────────────────────────
MetricX needs ``torch`` + ``transformers`` + ``sentencepiece`` (the `metricx`
extra) AND the Google ``metricx24`` package, which is NOT on PyPI — install it
from source:

    pip install 'mt-eval[metricx]'
    pip install git+https://github.com/google-research/metricx

Without these, ``HAS_METRICX`` is False and every entry point returns None
(disclosed absence) — we never fabricate a MetricX score.

REFERENCES:
  - Juraska et al. (2024). "MetricX-24: The Google Submission to the WMT 2024
    Metrics Shared Task." WMT 2024. (arXiv:2410.03983)
  - Juraska et al. (2025). "MetricX-25 …" (arXiv:2510.24707)
  - Code: https://github.com/google-research/metricx (Apache-2.0)
────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

from dataclasses import dataclass

# MetricX needs torch + transformers AND the google-research metricx package.
# We guard the whole stack behind one flag, mirroring COMET's HAS_COMET. The
# names imported here are module globals so tests can monkeypatch them (the
# same pattern metrics_comet uses for download_model/load_from_checkpoint).
try:
    import torch
    from transformers import AutoTokenizer
    try:
        from metricx24.models import MT5ForRegression
    except ImportError:
        # MetricX-25 drop-in: same class name, newer package.
        from metricx25.models import MT5ForRegression  # type: ignore
    HAS_METRICX = True
except ImportError:
    HAS_METRICX = False


# ── Direction + score range ──────────────────────────────────────────────────
# MetricX predicts an ERROR score: LOWER IS BETTER. This is the single most
# important fact about storing/displaying it. Every result carries this flag.
METRICX_LOWER_IS_BETTER = True
# The model clips its output to [0, 25] (0 = perfect, 25 = worst).
METRICX_SCORE_MIN = 0.0
METRICX_SCORE_MAX = 25.0

# Default checkpoint — the accessible "large" hybrid model. Override via config.
DEFAULT_METRICX_MODEL = "google/metricx-24-hybrid-large-v2p6"
# All MetricX-24 hybrid checkpoints use the mT5-XL tokenizer.
DEFAULT_METRICX_TOKENIZER = "google/mt5-xl"
# MetricX-24 truncates inputs to 1536 tokens.
METRICX_MAX_INPUT_LENGTH = 1536

# Low-resource coverage is read from the language-card SSOT, shared with COMET.
from mt_eval_harness.language_cards import (
    is_xlmr_high_resource as _is_xlmr_high_resource,
)


@dataclass
class MetricXResult:
    """Result of MetricX scoring for a single run.

    NOTE on direction: ``corpus_score`` and ``per_entry_scores`` are MetricX
    ERROR magnitudes — LOWER IS BETTER (``lower_is_better`` is always True).
    Callers must sort/compare accordingly; never treat it like COMET/chrF++.
    """
    corpus_score: float              # Mean per-segment MetricX error (0–25, ↓ better)
    per_entry_scores: list[float]    # One error score per entry, in order
    model_name: str                  # Which MetricX checkpoint was used
    tokenizer_name: str              # mT5 tokenizer used
    n_entries: int                   # Number of entries scored
    target_lang: str                 # Target language code
    qe_mode: bool = False            # True if scored reference-free (QE)
    low_resource_warning: bool = False  # True if target not in the high-resource tier
    lower_is_better: bool = METRICX_LOWER_IS_BETTER  # ALWAYS True — direction guard
    score_max: float = METRICX_SCORE_MAX             # 25.0 — for normalized display


# ── Input formatting (pure; unit-tested directly) ────────────────────────────

def build_metricx_input(
    source: str, hypothesis: str, reference: str = "", qe: bool = False
) -> str:
    """Build the MetricX-24 input string from src/hyp/ref.

    Matches the official metricx24 template exactly:
      reference-based: ``source: {src} candidate: {hyp} reference: {ref}``
      QE (no ref):     ``source: {src} candidate: {hyp}``
    """
    if qe:
        return f"source: {source} candidate: {hypothesis}"
    return f"source: {source} candidate: {hypothesis} reference: {reference}"


def _strip_eos(input_ids: list[int], eos_token_id: int | None) -> list[int]:
    """Remove the trailing EOS token mT5 appends, as MetricX's predict.py does.

    Only strips a SINGLE trailing EOS (never one in the middle). Returns the
    list unchanged when there is no trailing EOS or no eos id is known.
    """
    if eos_token_id is not None and input_ids and input_ids[-1] == eos_token_id:
        return input_ids[:-1]
    return input_ids


# ── Model loading (cached) ───────────────────────────────────────────────────
# Loading the checkpoint is slow (and downloads multiple GB on first use); we
# cache (model, tokenizer) keyed by their names, exactly like metrics_comet.
_cached = None              # tuple[model, tokenizer] | None
_cached_key = None         # (model_name, tokenizer_name) | None


def _resolve_device(device: str | None) -> str:
    """Pick the inference device: explicit override, else CUDA if available."""
    if device:
        return device
    if HAS_METRICX and torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _load_model(
    model_name: str = DEFAULT_METRICX_MODEL,
    tokenizer_name: str = DEFAULT_METRICX_TOKENIZER,
):
    """Load a MetricX model + tokenizer, using a module-level cache.

    Cache is checked FIRST so a pre-populated cache (e.g. a test fixture)
    returns without requiring the metricx stack to import — the same trick
    metrics_comet._load_model uses for mocking.
    """
    global _cached, _cached_key

    key = (model_name, tokenizer_name)
    if _cached is not None and _cached_key == key:
        return _cached

    if not HAS_METRICX:
        raise RuntimeError(
            "MetricX is not available. Install it with:\n"
            "  pip install 'mt-eval[metricx]'\n"
            "  pip install git+https://github.com/google-research/metricx\n"
            "(the MetricX model code is not on PyPI; the extra adds torch + "
            "transformers + sentencepiece)."
        )

    print(f"  Loading MetricX model: {model_name}")
    print(f"  (First run downloads the checkpoint + mT5 tokenizer)")
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_name, use_fast=False, legacy=False)
    model = MT5ForRegression.from_pretrained(model_name)
    model.eval()
    _cached = (model, tokenizer)
    _cached_key = key
    print(f"  MetricX model loaded: {model_name}")
    return _cached


def _predict_scores(
    model,
    tokenizer,
    texts: list[str],
    device: str | None = None,
    batch_size: int = 8,
) -> list[float]:
    """Run MetricX inference over pre-formatted input strings → error scores.

    Faithful to metricx24/predict.py: per-example tokenize → strip trailing EOS
    → pad batch → read ``output.predictions`` (the regression head). This is the
    only torch-dependent function; tests mock it to exercise the aggregation
    logic without downloading weights.
    """
    dev = _resolve_device(device)
    model.to(dev)
    scores: list[float] = []
    with torch.no_grad():
        for start in range(0, len(texts), batch_size):
            batch = texts[start:start + batch_size]
            id_lists = []
            for text in batch:
                ids = tokenizer(
                    text,
                    max_length=METRICX_MAX_INPUT_LENGTH,
                    truncation=True,
                    add_special_tokens=True,
                )["input_ids"]
                id_lists.append(_strip_eos(ids, getattr(tokenizer, "eos_token_id", None)))
            padded = tokenizer.pad({"input_ids": id_lists}, return_tensors="pt")
            output = model(
                input_ids=padded["input_ids"].to(dev),
                attention_mask=padded["attention_mask"].to(dev),
            )
            preds = output.predictions
            scores.extend(float(x) for x in preds.detach().cpu().tolist())
    return scores


def _valid_entries(entries: list[dict], qe: bool) -> list[dict]:
    """Entries with the fields MetricX needs (ref required unless QE)."""
    return [
        e for e in entries
        if not e.get("error")
        and (e.get("source", "") or "").strip()
        and (e.get("predicted", "") or "").strip()
        and (qe or (e.get("expected", "") or "").strip())
    ]


def compute_metricx(
    entries: list[dict],
    target_lang: str = "",
    model_name: str = DEFAULT_METRICX_MODEL,
    tokenizer_name: str = DEFAULT_METRICX_TOKENIZER,
    qe: bool = False,
    batch_size: int = 8,
    device: str | None = None,
) -> MetricXResult | None:
    """Compute MetricX-24 scores for a list of entry dicts.

    Requires entries with 'source', 'predicted', and (unless ``qe``) 'expected'
    — the same schema as tester.py. Returns a MetricXResult whose scores are
    LOWER-IS-BETTER error magnitudes (0–25), or None if MetricX is unavailable
    or there are no valid entries (disclosed absence, never a fabricated 0).

    Args:
        entries: Per-entry result dicts. Errored / empty entries are skipped.
        target_lang: BCP-47/ISO code — used only for the low-resource note.
        model_name: MetricX checkpoint id (override for xl/xxl or MetricX-25).
        tokenizer_name: mT5 tokenizer id (shared across MetricX-24 checkpoints).
        qe: Reference-free QE mode (source + hypothesis only).
        batch_size: Inference batch size.
        device: 'cuda' / 'cpu' override; auto-detected when None.
    """
    if not HAS_METRICX:
        return None

    valid = _valid_entries(entries, qe)
    if not valid:
        print("  MetricX: No valid entries to score (all errors or empty)")
        return None

    lang_base = target_lang.split("-")[0].lower() if target_lang else ""
    is_low_resource = bool(lang_base) and not _is_xlmr_high_resource(lang_base)
    if is_low_resource:
        print(
            f"  ⚠️  MetricX note: '{target_lang}' is not in the backbone's high-resource tier.\n"
            f"     Scores are still computed but may be less reliable for this language.\n"
            f"     Use MetricX scores as a relative ranking signal, not an absolute measure."
        )

    texts = [
        build_metricx_input(
            e["source"], e["predicted"], "" if qe else e["expected"], qe=qe
        )
        for e in valid
    ]

    model, tokenizer = _load_model(model_name, tokenizer_name)
    mode = "QE, reference-free" if qe else "reference-based"
    print(f"  MetricX: Scoring {len(texts)} entries ({model_name}, {mode})…")
    per_entry = _predict_scores(
        model, tokenizer, texts, device=device, batch_size=batch_size
    )
    corpus = sum(per_entry) / len(per_entry)
    print(f"  MetricX score: {corpus:.3f}  ↓ (lower=better, 0–{METRICX_SCORE_MAX:g})")

    return MetricXResult(
        corpus_score=round(corpus, 4),
        per_entry_scores=[round(s, 4) for s in per_entry],
        model_name=model_name,
        tokenizer_name=tokenizer_name,
        n_entries=len(valid),
        target_lang=target_lang,
        qe_mode=qe,
        low_resource_warning=is_low_resource,
    )


def corpus_metricx(
    entries: list[dict], target_lang: str = "", qe: bool = False
) -> float | None:
    """Metric function compatible with significance.py / confidence.py.

    Computes the corpus MetricX error score. Returns None — NOT 0.0 — when
    MetricX is unavailable or there are no valid entries, mirroring
    corpus_comet(): 0.0 is a real (PERFECT) MetricX score here, so "metric
    absent" must stay distinguishable from "scored 0". Note this re-runs neural
    inference; the CI path instead bootstraps from cached per-entry scores (see
    confidence._metricx_from_cached_scores) to avoid re-running the model.
    """
    if not HAS_METRICX:
        return None
    valid = _valid_entries(entries, qe)
    if not valid:
        return None
    texts = [
        build_metricx_input(
            e["source"], e["predicted"], "" if qe else e["expected"], qe=qe
        )
        for e in valid
    ]
    model, tokenizer = _load_model()
    per_entry = _predict_scores(model, tokenizer, texts)
    return sum(per_entry) / len(per_entry)
