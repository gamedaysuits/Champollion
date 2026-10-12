"""
Test Harness — Deterministic metric analyzer for RunLog files.

Takes a RunLog JSON from the Run Harness and computes:
    - Exact match rate (string equality after normalization)
    - chrF++ score (via sacrebleu)
    - BLEU score (via sacrebleu)
    - COMET score (via unbabel-comet, if installed)
    - Bootstrap 95% confidence intervals on all corpus metrics
    - Plugin metrics (via MetricPlugin protocol)
    - Per-segment breakdown
    - Per-difficulty breakdown
    - Error rate and error categorization
    - Token/cost aggregates

Design decisions:
    - This module is OFFLINE — it never makes API calls. All analysis
      is deterministic and reproducible from the logged predictions.
    - Language-specific metrics (FST validity, morphological linting,
      semantic validation) are registered as MetricPlugin instances,
      NOT hardcoded into this module.
    - Dependencies: sacrebleu. COMET optional but recommended.
    - Output is a TestReport JSON file alongside the RunLog.
"""

from __future__ import annotations

import json
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

from mt_eval_harness.rankable_metrics import sacrebleu_metric


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class EntryMetrics:
    """Per-entry analysis results."""
    id: int = 0
    source: str = ""   # Source text (matches runner.py enrichment key)
    expected: str = ""  # Reference translation
    raw_predicted: str = "" # Raw model output before hooks
    predicted: str = "" # Model output
    segment: str = ""
    difficulty: int = 0
    domain: str = ""

    # Core metrics (built-in)
    exact_match: bool = False
    chrf_score: float = 0.0
    bleu_score: float = 0.0
    ter_score: float = 0.0
    length_ratio: float = 0.0

    # From RunLog
    latency_s: float = 0.0
    cost_usd: float = 0.0
    cached: bool = False  # result came from the local cache (cost_usd is the ORIGINAL price)
    tool_call_count: int = 0
    error: str | None = None
    # Upstream endpoint the gateway routed to (OpenRouter `provider`), or None
    # for first-party/local providers and cache hits. Routing is not pinned, so
    # two runs of the same model can be served by endpoints with different
    # quantization — recording it keeps a score attributable.
    served_by: str | None = None

    # Plugin metrics get merged here
    plugin_metrics: dict[str, Any] = field(default_factory=dict)


@dataclass
class SegmentMetrics:
    """Aggregate metrics for a dataset segment or difficulty level."""
    name: str = ""
    count: int = 0
    exact_match_count: int = 0
    miss_count: int = 0
    error_count: int = 0

    # Averages
    avg_chrf: float = 0.0
    avg_bleu: float = 0.0
    avg_latency_s: float = 0.0
    # None when no entry in the group carries a price (an unpriced or local
    # model): unknown, never a $0 — the run-level rule (run_card.run_total_cost)
    total_cost_usd: float | None = 0.0

    # Plugin aggregate metrics
    plugin_aggregates: dict[str, Any] = field(default_factory=dict)

    @property
    def exact_match_rate(self) -> float:
        return self.exact_match_count / self.count if self.count else 0.0

    @property
    def error_rate(self) -> float:
        return self.error_count / self.count if self.count else 0.0


# ---------------------------------------------------------------------------
# String normalization for exact match comparison
# ---------------------------------------------------------------------------

def normalize_text(text: str) -> str:
    """Normalize text for exact match comparison.

    Applies Unicode NFC normalization, case folding, and whitespace
    normalization. This ensures that trivial formatting differences
    don't produce false negatives.
    """
    text = unicodedata.normalize("NFC", text)
    text = text.strip().lower()
    text = " ".join(text.split())  # Collapse whitespace
    return text


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------

def analyze_run(
    log_path: str | Path,
    output_path: str | None = None,
    metric_plugins: list | None = None,
    compute_ci: bool = True,
    n_bootstrap_ci: int = 1000,
    glossary_file: str | None = None,
) -> dict:
    """Analyze a RunLog file and produce a TestReport.

    Args:
        log_path: Path to the RunLog JSON file.
        output_path: Optional output path for the TestReport.
                     Defaults to log_path with _report.json suffix. Any other
                     path is recorded in the run log (run_card.
                     REPORT_PATHS_KEY) so `card` / `compare` find the report.
        metric_plugins: Optional list of MetricPlugin instances.
        compute_ci: If True, compute bootstrap 95% confidence intervals
                    on corpus-level metrics. Default: True.
        n_bootstrap_ci: Number of bootstrap iterations for CI. Default: 1000
                        (matches SacreBLEU/WMT convention).
        glossary_file: the glossary `mt-eval test --glossary` scored
                       terminology with (it overrides the run's), recorded in
                       the report's ``glossary`` block.

    Returns:
        Complete TestReport dict.
    """
    log_path = Path(log_path)
    if not log_path.exists():
        raise FileNotFoundError(f"RunLog not found: {log_path}")

    run_log = json.loads(log_path.read_text(encoding="utf-8"))

    if output_path is None:
        output_path = log_path.with_name(log_path.stem + "_report.json")

    report = _analyze(
        run_log,
        output_path=output_path,
        metric_plugins=metric_plugins,
        compute_ci=compute_ci,
        n_bootstrap_ci=n_bootstrap_ci,
        source_log_path=str(log_path.resolve()),
        test_glossary=glossary_file,
    )
    # A report written anywhere but beside the log: the log records where,
    # so `mt-eval card <log>` shows these scores instead of finding nothing
    # (Round 9 researcher: "chrF++ 0.0 / BLEU 0.0" for real 8.2 / 0.5).
    if isinstance(report, dict) and "overall" in report:
        from mt_eval_harness.run_card import record_report_path
        why = record_report_path(log_path, output_path)
        if why:
            print(f"  ⚠ The run log could not record where this report is "
                  f"({why}): `mt-eval card {log_path.name} --report "
                  f"{Path(output_path).name}` shows it.")
    return report


def analyze_run_log(
    run_log: dict,
    output_path: str | Path | None = None,
    metric_plugins: list | None = None,
    compute_ci: bool = True,
    n_bootstrap_ci: int = 1000,
    source_log_path: str | None = None,
    summary_composite: bool = True,
) -> dict:
    """Analyze an in-memory RunLog dict and produce a TestReport.

    Called automatically at the end of execute_run() so users
    don't need a separate 'mt-eval test' step.

    Args:
        run_log: The RunLog dict (as returned by build_run_log).
        output_path: Optional output path for the TestReport.
        metric_plugins: Optional list of MetricPlugin instances.
        compute_ci: If True, compute bootstrap 95% CIs. Default: True.
        n_bootstrap_ci: Number of bootstrap iterations for CI. Default: 1000.
        summary_composite: no effect since the scoring standard retired
            the composite (scoring.SCORING_STANDARD); kept so existing
            callers keep working. The summary's headline is chrF++.
        source_log_path: Path to the source RunLog file. Stored in the
            TestReport so publish.py can find the RunLog without
            relying on filename inference.

    Returns:
        Complete TestReport dict.
    """
    return _analyze(
        run_log,
        output_path=output_path,
        metric_plugins=metric_plugins,
        compute_ci=compute_ci,
        n_bootstrap_ci=n_bootstrap_ci,
        source_log_path=source_log_path,
        summary_composite=summary_composite,
    )


def _analyze(
    run_log: dict,
    output_path: str | Path | None = None,
    metric_plugins: list | None = None,
    compute_ci: bool = True,
    n_bootstrap_ci: int = 1000,
    source_log_path: str | None = None,
    summary_composite: bool = True,
    test_glossary: str | None = None,
) -> dict:
    """Core analysis logic shared by file-based and in-memory entry points.

    ``test_glossary``: a glossary given to `mt-eval test --glossary` (it
    overrides the run's own for the terminology score); recorded in the
    report's ``glossary`` block either way."""
    results = run_log.get("results", [])

    if not results:
        print("  WARNING: RunLog contains no results")
        return {"error": "No results in RunLog"}

    print(f"  Analyzing {len(results)} entries")

    # Setup sacrebleu metrics if available
    # One definition of each sacreBLEU metric (rankable_metrics.sacrebleu_metric)
    # so the signature a contest freezes is the signature scoring produces.
    chrf_metric = sacrebleu_metric("chrf")
    bleu_metric = sacrebleu_metric("bleu")
    ter_metric = sacrebleu_metric("ter")
    # Secondary standard metrics (shown beside chrF++, never blended):
    #   - spBLEU: BLEU on the FLORES-200 SentencePiece tokenizer → comparable across
    #     scripts/segmentation (the NLLB/FLORES lingua-franca number reviewers expect).
    #   - plain chrF (word_order=0): the figure FLORES/WMT tables report alongside our
    #     chrF++ (word_order=2). The flores200 tokenizer downloads on first use.
    # spBLEU's FLORES-200 tokenizer needs `sentencepiece` (a core dep) AND
    # constructs eagerly, so guard it: a missing tokenizer leaves spBLEU
    # unavailable (None, disclosed) — it must NOT crash the whole analysis. It
    # is a secondary standard metric, never part of the headline.
    try:
        spbleu_metric = sacrebleu_metric("spbleu")
    except Exception as exc:
        print(f"  ⚠ spBLEU unavailable (FLORES-200 tokenizer needs `sentencepiece`): {exc}")
        spbleu_metric = None
    chrf_plain_metric = sacrebleu_metric("chrf_plain")

    # Only the plugins the caller passed. Analysis used to auto-load
    # DoublePassCompliancePlugin when the target's card had a `rules` field,
    # read through a private rglob of every card file; the atlas cutover
    # dropped `rules` from every card (shared/card-field-disposition.json), so
    # that load could never fire. Removed in 0.2.0.
    plugins = metric_plugins or []
    config_dict = run_log.get("config", {})
    target_code = config_dict.get("target_lang_code")

    if plugins:
        print(f"  Active plugins: {', '.join(p.name for p in plugins)}")


    # --- Per-entry analysis ---
    entry_metrics: list[EntryMetrics] = []
    # Collect plugin results for aggregation
    plugin_entry_results: dict[str, list[dict]] = {p.name: [] for p in plugins}

    for r in results:
        em = EntryMetrics(
            id=r["id"],
            source=r.get("source", ""),
            expected=r.get("expected", ""),
            raw_predicted=r.get("raw_predicted", r.get("predicted", "")),
            predicted=r.get("predicted", ""),
            segment=r.get("segment", ""),
            difficulty=r.get("difficulty", 0),
            domain=r.get("domain", ""),
            latency_s=r.get("latency_s", 0),
            served_by=r.get("served_by"),
            cost_usd=r.get("cost_usd", 0),
            cached=bool(r.get("cached", False)),
            tool_call_count=r.get("tool_call_count", 0),
            error=r.get("error"),
        )

        expected_norm = normalize_text(em.expected)
        predicted_norm = normalize_text(em.predicted)

        if em.error:
            entry_metrics.append(em)
            continue

        # --- Exact match ---
        em.exact_match = (expected_norm == predicted_norm) and bool(predicted_norm)

        # --- chrF++ ---
        if em.expected and em.predicted:
            try:
                em.chrf_score = chrf_metric.corpus_score(
                    [em.predicted], [[em.expected]]
                ).score
            except Exception as exc:
                em.chrf_score = None
                print(f"  ⚠ chrF++ failed for entry {em.id}: {exc}")

        # --- BLEU ---
        if em.expected and em.predicted:
            try:
                em.bleu_score = bleu_metric.corpus_score(
                    [em.predicted], [[em.expected]]
                ).score
            except Exception as exc:
                em.bleu_score = None
                print(f"  ⚠ BLEU failed for entry {em.id}: {exc}")

        # --- TER (Translation Edit Rate) ---
        # Lower is better: minimum edit distance / reference length.
        # sacrebleu returns TER as a 0–100 scale percentage.
        if em.expected and em.predicted:
            try:
                em.ter_score = ter_metric.corpus_score(
                    [em.predicted], [[em.expected]]
                ).score
            except Exception as exc:
                em.ter_score = None
                print(f"  ⚠ TER failed for entry {em.id}: {exc}")

        # --- Length Ratio ---
        # Character-level: len(predicted) / len(expected).
        # Ideal is 1.0. Values <0.5 suggest truncation; >2.0 suggest
        # hallucination/inflation. Trivial diagnostic metric.
        if em.expected:
            em.length_ratio = round(
                len(em.predicted) / len(em.expected), 4
            ) if len(em.expected) > 0 else 0.0

        # --- Plugin metrics ---
        entry_dict = {
            "id": em.id,
            "source": em.source,
            "expected": em.expected,
            "raw_predicted": em.raw_predicted,
            "predicted": em.predicted,
            "segment": em.segment,
            "difficulty": em.difficulty,
        }
        for plugin in plugins:
            try:
                plugin_result = plugin.compute(entry_dict)
                em.plugin_metrics[plugin.name] = plugin_result
                plugin_entry_results[plugin.name].append(plugin_result)
            except Exception as exc:
                em.plugin_metrics[plugin.name] = {"error": str(exc)}
                plugin_entry_results[plugin.name].append({"error": str(exc)})

        entry_metrics.append(em)

    # --- Aggregate by segment ---
    segments = _aggregate_segment_metrics(entry_metrics)

    # --- Aggregate by difficulty ---
    difficulties = _aggregate_difficulty_metrics(entry_metrics)

    # --- Aggregate by domain ---
    domains = _aggregate_domain_metrics(entry_metrics)

    # --- Overall metrics ---
    overall = _compute_overall(entry_metrics)

    # --- Corpus-level chrF++ and BLEU ---
    all_preds = [em.predicted for em in entry_metrics if not em.error]
    all_refs = [em.expected for em in entry_metrics if not em.error]
    if all_preds and all_refs:
        try:
            overall["corpus_chrf"] = round(
                chrf_metric.corpus_score(all_preds, [all_refs]).score, 2
            )
        except Exception as exc:
            print(f"  ⚠ Corpus chrF++ computation failed: {exc}")
            overall["corpus_chrf"] = None

    all_preds = [em.predicted for em in entry_metrics if not em.error]
    all_refs = [em.expected for em in entry_metrics if not em.error]
    if all_preds and all_refs:
        try:
            overall["corpus_bleu"] = round(
                bleu_metric.corpus_score(all_preds, [all_refs]).score, 2
            )
        except Exception as exc:
            print(f"  ⚠ Corpus BLEU computation failed: {exc}")
            overall["corpus_bleu"] = None

    # --- Corpus-level TER ---
    if all_preds and all_refs:
        try:
            overall["corpus_ter"] = round(
                ter_metric.corpus_score(all_preds, [all_refs]).score, 2
            )
        except Exception as exc:
            print(f"  ⚠ Corpus TER computation failed: {exc}")
            overall["corpus_ter"] = None

    # --- Secondary standard metrics: spBLEU + plain chrF (beside the headline) ---
    if all_preds and all_refs:
        if spbleu_metric is not None:
            try:
                overall["corpus_spbleu"] = round(
                    spbleu_metric.corpus_score(all_preds, [all_refs]).score, 2
                )
            except Exception as exc:
                print(f"  ⚠ spBLEU (FLORES-200 tokenizer) computation failed: {exc}")
                overall["corpus_spbleu"] = None
        else:
            overall["corpus_spbleu"] = None
        try:
            overall["corpus_chrf_plain"] = round(
                chrf_plain_metric.corpus_score(all_preds, [all_refs]).score, 2
            )
        except Exception as exc:
            print(f"  ⚠ Plain chrF computation failed: {exc}")
            overall["corpus_chrf_plain"] = None

    # --- SacreBLEU signatures (reproducibility) ---
    # The full sacreBLEU signature for each surface metric (tokenizer, smoothing,
    # case, number of references, sacreBLEU version). Stored so any published
    # surface score is REPRODUCIBLE: a third party can re-run sacreBLEU with the
    # same signature against the sha-pinned corpus and obtain the same number.
    # Signatures describe HOW a metric was computed — the chrF++ one ("chrf")
    # is shown beside the headline on every surface (scoring standard/1).
    if all_preds and all_refs:
        signatures: dict[str, str] = {}
        for _sig_name, _sig_metric in (
            ("chrf", chrf_metric),
            ("bleu", bleu_metric),
            ("ter", ter_metric),
            ("spbleu", spbleu_metric),
            ("chrf_plain", chrf_plain_metric),
        ):
            if _sig_metric is None:
                continue  # spBLEU's FLORES-200 tokenizer may be unavailable
            try:
                signatures[_sig_name] = str(_sig_metric.get_signature())
            except Exception as exc:
                print(f"  ⚠ sacreBLEU signature for {_sig_name} unavailable: {exc}")
        if signatures:
            overall["sacrebleu_signatures"] = signatures

    # --- Average Length Ratio ---
    # Averaged across non-error entries. A corpus-level diagnostic:
    # significantly below 1.0 indicates systematic truncation,
    # above 1.0 indicates systematic inflation.
    non_error_with_ref = [
        em for em in entry_metrics if not em.error and em.expected
    ]
    if non_error_with_ref:
        avg_lr = sum(em.length_ratio for em in non_error_with_ref) / len(non_error_with_ref)
        overall["avg_length_ratio"] = round(avg_lr, 4)
        # Run-level inflation and deflation checks (score_caveats: the
        # scoring spec's >2.0 inflation and <0.5 truncation bounds on the
        # mean or on ≥25% of entries). Display only — the report records
        # them; summaries and cards warn.
        from mt_eval_harness.score_caveats import (
            length_deflation, length_inflation,
        )
        _lr_rows = [{"expected": em.expected, "error": em.error,
                     "length_ratio": em.length_ratio}
                    for em in non_error_with_ref]
        overall["length_inflation"] = length_inflation(_lr_rows)
        overall["length_deflation"] = length_deflation(_lr_rows)

    # --- COMET scoring (neural metric) ---
    # COMET runs on non-error entries with source, expected, and predicted.
    # It's a heavy operation (loads ~2.3 GB model) but provides the best
    # correlation with human quality judgments for high-resource languages.
    # For African languages, we auto-select AfriCOMET (masakhane/africomet-mtl)
    # which provides better correlation with human judgments for those languages.
    from mt_eval_harness.metrics_comet import compute_comet, HAS_COMET, resolve_comet_model

    comet_result = None
    if HAS_COMET:
        # Resolve the best COMET model for this target language.
        # AfriCOMET auto-selects for African languages in the registry.
        # CLI --comet-model override can be passed via config.
        explicit_model = config_dict.get("comet_model") if config_dict else None
        resolved_model = resolve_comet_model(
            target_lang=target_code or "",
            explicit_model=explicit_model,
        )

        comet_entries = [
            {
                "source": em.source,
                "expected": em.expected,
                "predicted": em.predicted,
                "error": em.error,
            }
            for em in entry_metrics
        ]
        comet_result = compute_comet(
            comet_entries,
            target_lang=target_code or "",
            model_name=resolved_model,
        )
        if comet_result:
            overall["comet_score"] = comet_result.corpus_score
            overall["comet_model"] = comet_result.model_name
            overall["comet_low_resource_warning"] = comet_result.low_resource_warning
        else:
            overall["comet_unavailable"] = (
                f"COMET ({resolved_model}) produced no score — no entry had "
                f"a source, a reference and no error")
    else:
        # COMET not installed — say how to add it. Scoring installs nothing
        # (installing is the explicit `mt-eval setup --comet` step). The
        # reason is recorded so the report and the run card say it too.
        from mt_eval_harness.metrics_comet import comet_unavailable_reason
        from mt_eval_harness.setup_wizard import prompt_comet_install
        prompt_comet_install()
        overall["comet_unavailable"] = comet_unavailable_reason()
        if overall.get("comet_score") is None:
            overall["comet_score"] = None

    # --- Reference-free QE (no-reference profile) ---
    # QE scores adequacy from SOURCE + MT only (no reference). We compute it when
    # this run has NO references (the no-reference case needs it) and the language
    # card declares a QE model — for normal reference-based runs we skip it to
    # avoid a second neural-inference pass. `has_references` drives profile choice.
    from mt_eval_harness.metrics_comet import (
        compute_qe, resolve_qe_model, HAS_COMET as _HAS_COMET,
    )
    has_refs = any((em.expected or "").strip() for em in entry_metrics if not em.error)
    overall["has_references"] = has_refs
    overall["qe_score"] = None
    overall["qe_model"] = None
    if not has_refs:
        qe_model = resolve_qe_model(target_lang=target_code or "")
        if qe_model and _HAS_COMET:
            qe_entries = [
                {"source": em.source, "predicted": em.predicted, "error": em.error}
                for em in entry_metrics
            ]
            qe_result = compute_qe(
                qe_entries, target_lang=target_code or "", model_name=qe_model,
            )
            if qe_result:
                overall["qe_score"] = qe_result.corpus_score
                overall["qe_model"] = qe_result.model_name
        if overall["qe_score"] is None:
            reason = (
                "no QE model declared on the language card (metricModelSupport.qe)"
                if not qe_model
                else "unbabel-comet is not installed"
                if not _HAS_COMET
                else "QE scoring produced no result"
            )
            print(
                f"  ⚠️  NO-REFERENCE run without an adequacy signal: {reason}.\n"
                f"     With no references there is no chrF++ headline: the run has\n"
                f"     only diagnostics (FST acceptance + behavioral checks), which\n"
                f"     cannot detect fluent in-language garbage. Read them as\n"
                f"     fluency/validity, NOT translation adequacy, for this run."
            )

    # --- FUSE-style comparator (opt-in; reported separately) ---
    # A reimplementation of the AmericasNLP-2025 FUSE approach (untrained blend),
    # computed ONLY when explicitly requested (config compute_fuse) because LaBSE
    # inference is heavy. See metrics_fuse for the honesty caveats.
    overall["fuse_score"] = None
    if config_dict and config_dict.get("compute_fuse"):
        from mt_eval_harness.metrics_fuse import compute_fuse, HAS_LABSE as _HAS_LABSE
        if not _HAS_LABSE:
            print(
                "  ⚠ FUSE comparator requested but unavailable — install the `fuse` "
                "extra (sentence-transformers). Reporting fuse_score=None."
            )
        else:
            fuse_entries = [
                {"expected": em.expected, "predicted": em.predicted, "error": em.error}
                for em in entry_metrics
            ]
            fuse_result = compute_fuse(fuse_entries)
            if fuse_result:
                overall["fuse_score"] = fuse_result.corpus_score
                overall["fuse_components"] = fuse_result.components_used
                overall["fuse_untrained"] = fuse_result.untrained
                print(
                    f"  FUSE-style comparator: {fuse_result.corpus_score:.4f} "
                    f"(untrained blend of {', '.join(fuse_result.components_used)})"
                )

    # --- MetricX-24 (opt-in; NEURAL metric, reported SEPARATELY, NOT in composite) ---
    # MetricX-24 (Google, Apache-2.0) topped the WMT24 Metrics shared task and is
    # the metric WMT24++/TranslateGemma report against — it buys apples-to-apples
    # comparability with 2024-2026 frontier MT papers. It is a LOWER-IS-BETTER error
    # metric (0=perfect, 25=worst); direction is carried through to storage/display.
    # Opt-in like FUSE (the mT5 backbone is heavy). Falls back to reference-free QE
    # mode when the run has no references, so it still produces a score.
    overall["metricx_score"] = None
    metricx_result = None
    if config_dict and config_dict.get("compute_metricx"):
        from mt_eval_harness.metrics_metricx import (
            compute_metricx,
            HAS_METRICX as _HAS_METRICX,
            DEFAULT_METRICX_MODEL,
        )
        if not _HAS_METRICX:
            print(
                "  ⚠ MetricX requested but unavailable — install the `metricx` extra "
                "(python3 -m pip install 'mt-eval-harness[metricx]' + the model "
                "code from github.com/google-research/metricx). Reporting "
                "metricx_score=None."
            )
        else:
            metricx_model = config_dict.get("metricx_model") or DEFAULT_METRICX_MODEL
            metricx_entries = [
                {
                    "source": em.source,
                    "expected": em.expected,
                    "predicted": em.predicted,
                    "error": em.error,
                }
                for em in entry_metrics
            ]
            metricx_result = compute_metricx(
                metricx_entries,
                target_lang=target_code or "",
                model_name=metricx_model,
                qe=not has_refs,
            )
            if metricx_result:
                overall["metricx_score"] = metricx_result.corpus_score
                overall["metricx_model"] = metricx_result.model_name
                overall["metricx_lower_is_better"] = metricx_result.lower_is_better
                overall["metricx_score_max"] = metricx_result.score_max
                overall["metricx_qe_mode"] = metricx_result.qe_mode
                overall["metricx_low_resource_warning"] = metricx_result.low_resource_warning

    # --- Bootstrap confidence intervals ---
    # Compute 95% CIs on corpus-level metrics. Uses the same bootstrap
    # methodology as SacreBLEU and WMT shared tasks (see confidence.py
    # module header for full justification).
    if compute_ci:
        from mt_eval_harness.confidence import compute_all_cis

        # Build entry dicts in the format expected by significance.py
        # metric functions (source, expected, predicted, error, exact_match).
        # Also include per-entry COMET scores (pre-computed above) so that
        # confidence.py can bootstrap from cached values without re-running
        # neural inference on each of the 1000 bootstrap iterations.
        ci_entries = []
        # COMET/MetricX per-entry scores are ALIGNED to entry_metrics (None
        # where an entry was not scorable): index by position, never re-count.
        for idx, em in enumerate(entry_metrics):
            entry = {
                "source": em.source,
                "expected": em.expected,
                "predicted": em.predicted,
                "error": em.error,
                "exact_match": em.exact_match,
                "plugin_metrics": em.plugin_metrics,
            }
            # Inject pre-computed COMET / MetricX scores so the CI path
            # bootstraps from cached values, not a second neural-inference pass.
            if comet_result and comet_result.per_entry_scores[idx] is not None:
                entry["comet_score"] = comet_result.per_entry_scores[idx]
            if metricx_result and metricx_result.per_entry_scores[idx] is not None:
                entry["metricx_score"] = metricx_result.per_entry_scores[idx]
            ci_entries.append(entry)

        cis = compute_all_cis(
            ci_entries,
            n_bootstrap=n_bootstrap_ci,
        )
        if cis:
            overall["confidence_intervals"] = cis
            print(f"  Bootstrap CIs: computed (n_bootstrap={n_bootstrap_ci})")

        # Per-tier CIs — group entries by difficulty and compute CIs per group
        from mt_eval_harness.confidence import compute_per_tier_cis

        # Inject difficulty field into CI entries (it wasn't included above
        # because compute_all_cis doesn't need it, but per-tier does)
        for ci_entry, em in zip(ci_entries, entry_metrics):
            ci_entry["difficulty"] = em.difficulty

        tier_cis = compute_per_tier_cis(
            ci_entries,
            n_bootstrap=n_bootstrap_ci,
        )
        if tier_cis:
            overall["confidence_intervals_by_tier"] = {
                str(k): v for k, v in tier_cis.items()
            }
            print(f"  Per-tier CIs: {len(tier_cis)} tiers")

    # --- Plugin aggregates ---
    plugin_overall = {}
    for plugin in plugins:
        try:
            agg = plugin.aggregate(plugin_entry_results[plugin.name])
            if agg:
                plugin_overall[plugin.name] = agg
        except Exception as exc:
            plugin_overall[plugin.name] = {"error": str(exc)}

    if plugin_overall:
        overall["plugin_metrics"] = plugin_overall

    # --- Build report ---
    report = {
        "run_id": run_log.get("run_id", "unknown"),
        "config": run_log.get("config", {}),
        # Absolute path to the source RunLog — used by publish.py to find
        # the original run data. Without this, publish relies on fragile
        # filename inference (_report.json → .json).
        "source_log": source_log_path,
        "overall": overall,
        "by_segment": {k: asdict(v) for k, v in segments.items()},
        "by_difficulty": {str(k): asdict(v) for k, v in sorted(difficulties.items())},
        "by_domain": {k: asdict(v) for k, v in sorted(domains.items())},
        "entries": [asdict(em) for em in entry_metrics],
    }
    # Where the model ran, when the RunLog recorded it (runner: loopback /
    # in-process) — the cost rule reads it (run_card.run_cost_label), and a
    # report compared or dashboarded without its RunLog must read the same.
    _locality = (run_log.get("provenance") or {}).get("endpoint_locality")
    if _locality:
        report["endpoint_locality"] = _locality
    # A method plugin's declared dependency class and list, for the same
    # rule (run_card.runs_on_this_machine: an S/O plugin with no gateway or
    # external-api dependency calls no API — synthetic researcher, Round 12).
    _plugin = (run_log.get("provenance") or {}).get("method_plugin")
    if isinstance(_plugin, dict) and (_plugin.get("dependency_class")
                                      or _plugin.get("dependencies") is not None):
        report["method_plugin"] = {
            "dependency_class": _plugin.get("dependency_class"),
            "dependencies": _plugin.get("dependencies")}

    # Include per-entry COMET scores if computed
    if comet_result:
        for entry, score in zip(report["entries"], comet_result.per_entry_scores):
            if score is not None:
                entry["comet_score"] = score

    # Include per-entry MetricX scores if computed (LOWER is better; 0–25)
    if metricx_result:
        for entry, score in zip(report["entries"], metricx_result.per_entry_scores):
            if score is not None:
                entry["metricx_score"] = score

    # What qualifies these scores (score_caveats): nmt-forge's train/test
    # near-twin reading carried in the RunLog, and the length-inflation
    # check. Recorded in the report and printed beside the headline — a
    # 150/150 near-twinned forge test set used to show a bare chrF++ 100.
    from mt_eval_harness.score_caveats import collect as _collect_caveats
    caveats = _collect_caveats(report, run_log)
    if caveats:
        report["score_caveats"] = caveats

    # Which glossary scored terminology (name + sha256, never its content):
    # one given to `mt-eval test --glossary` used to leave no trace, so
    # compare showed "Glossary —" for a run whose (now retired) composite it
    # had changed (0.2351 → 0.2155 for the same outputs; Round 9 researcher).
    from mt_eval_harness.plugin_discovery import glossary_record
    _gloss_cfg = dict(config_dict or {})
    if test_glossary:
        _gloss_cfg["glossary_file"] = test_glossary
    glossary = glossary_record(
        _gloss_cfg,
        given_at="mt-eval test --glossary" if test_glossary else None)
    if glossary:
        report["glossary"] = glossary

    # What the run paid in API calls, beside the price total. The total
    # stays None when no entry carries a price (a fabricated $0 wins every
    # cost comparison) — but a run that verifiably made no API call (a
    # loopback endpoint, a model decoded in this process) is not of UNKNOWN
    # cost: the report said cost_unknown: true beside cost_label "$0 API cost
    # (runs on this machine)" (Round 9 researcher). Same test as the label
    # (run_card.runs_on_this_machine), so the two cannot disagree.
    if overall.get("evaluated"):
        from mt_eval_harness.run_card import run_locality, runs_on_this_machine
        if overall.get("total_cost_usd") is not None:
            overall["api_cost_usd"] = overall["total_cost_usd"]
        elif runs_on_this_machine(*run_locality(run_log, report)):
            overall["cost_unknown"] = False
            overall["api_cost_usd"] = 0.0
        else:
            overall["api_cost_usd"] = None

    # The scoring standard this report was scored under (scoring.py): the
    # headline is corpus chrF++ (overall.corpus_chrf, its CI
    # confidence_intervals.corpus_chrf, its signature
    # sacrebleu_signatures.chrf). The weighted composite is retired — the
    # report carries no published_composite (a report from before the
    # standard may; readers label it "legacy composite (retired)").
    from mt_eval_harness.scoring import (
        PRIMARY_METRIC as _PRIMARY_METRIC, SCORING_STANDARD as _STANDARD)
    overall["scoring_standard"] = _STANDARD
    overall["primary_metric"] = _PRIMARY_METRIC
    derived, _derive_error = _derive_scores(report, run_log, output_path)
    # Why each null metric is null — the SAME block publish records on the
    # run card (publish._build_metric_availability), so the run card can show
    # a COMET / MetricX row saying "not computed — <why>" instead of no row
    # at all (synthetic researcher, Round 8).
    if derived is not None:
        from mt_eval_harness.publish import metric_availability_for_report
        overall["metric_availability"] = metric_availability_for_report(
            report, run_log, derived)
    # How to SAY the cost (run_card.cost_label) next to the stored number,
    # which stays null when unpriced: the plan, the run card, compare and the
    # publish preview said "$0 API cost (runs on this machine)" while the
    # report JSON said only "cost unknown" (synthetic researcher, Round 8).
    from mt_eval_harness.run_card import run_cost_label as _run_cost_label
    overall["cost_label"] = _run_cost_label(run_log, report)

    # What the model was told, as a pointer: the coaching file's name and
    # sha256 and the system prompt's sha256, with where the full text is (the
    # run log on this machine). Local only — publish builds its card from
    # named fields and never copies this block, so its prompt redaction for a
    # local-only corpus is untouched.
    instructions = instructions_pointer(run_log, source_log_path)
    if instructions:
        report["instructions"] = instructions

    # --- Write output ---
    derived_note = ""
    if output_path is not None:
        output_path = Path(output_path)
        output_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        # The report quotes every source/reference/output: one derived from a
        # local-only / sealed / consent-required corpus carries its terms in
        # a sidecar (corpus_loader.derived_mark), like the run log does.
        from mt_eval_harness.corpus_loader import (
            derived_file_note, derived_mark, write_derived_sidecar)
        mark = derived_mark(run_log, report)
        if mark:
            write_derived_sidecar(
                output_path, mark,
                derived_from=(Path(source_log_path).name if source_log_path
                              else str(run_log.get("run_id") or "run log")),
                written_by="mt-eval test")
            derived_note = derived_file_note(output_path, mark)

    # --- Print summary ---
    from mt_eval_harness.run_card import run_cost_label
    _print_summary(overall, segments, difficulties, domains, output_path,
                    config=run_log.get("config"), caveats=caveats,
                    provenance=run_log.get("provenance"),
                    cost_text=run_cost_label(run_log, report),
                    composite_line=summary_composite)
    line = instructions_line(instructions)
    if line:
        print(f"  Instructions:     {line}")
    if derived_note:
        print(derived_note)

    return report


# ---------------------------------------------------------------------------
# The derived diagnostics + the instructions pointer (report blocks)
# ---------------------------------------------------------------------------

def _derive_scores(report: dict, run_log: dict, report_path=None):
    """publish.derive_scores for a report: ``(derived, None)``, or
    ``(None, "<why>")`` when it cannot be computed here."""
    try:
        from mt_eval_harness.publish import derive_scores
        return derive_scores(report, run_log, report_path), None
    except Exception as exc:  # noqa: BLE001 — the availability block is skipped
        return None, f"{type(exc).__name__}: {exc}"


def instructions_pointer(run_log: dict, source_log_path=None) -> dict | None:
    """What the model was instructed with, as a pointer — never the text.

    For a run through the harness's own LLM path (a method plugin or MT
    engine gets no harness prompt, so None): the prompt condition, the
    coaching file's name and sha256, the system prompt's sha256 and length,
    and where the full text is — the run log on this machine
    (``provenance.system_prompt_used`` / ``provenance.coaching_prompt``).
    A coached run on a local-only corpus has its prompt redacted from the
    PUBLISHED card; the user's own report still says what the model got."""
    config = run_log.get("config") or {}
    prov = run_log.get("provenance") or {}
    if config.get("mt_method") or (config.get("method_path") or "").strip():
        return None
    prompt = prov.get("system_prompt_used") or ""
    prompt_sha = prov.get("system_prompt_sha256") or ""
    if not (prompt or prompt_sha):
        return None
    from mt_eval_harness.config import coaching_label
    where = (str(source_log_path) if source_log_path
             else f"the run log {run_log.get('run_id') or ''}.json".strip())
    block = {
        "prompt_condition": config.get("prompt_version"),
        "system_prompt_sha256": prompt_sha or None,
        "system_prompt_chars": len(prompt) if prompt else None,
        "coaching": coaching_label(config),
        "coaching_sha256": prov.get("coaching_prompt_sha256") or None,
        # The harness's built-in prompt is its template and the language
        # names — nothing from the corpus — so a naive run shows it whole:
        # "to sme" in a naive prompt went unseen (Round 11 researcher). A
        # coaching file or a prompt plugin stays a pointer.
        "builtin_prompt": (prompt if prompt and config.get("prompt_version")
                           == "naive" and not coaching_label(config)
                           else None),
        "full_text_in": where,
        "full_text_keys": ["provenance.system_prompt_used"]
        + (["provenance.coaching_prompt"] if prov.get("coaching_prompt")
           else []),
        "note": ("Local pointer: the full prompt stays in the run log on this "
                 "machine. A published card redacts a coached prompt on a "
                 "local-only corpus (publish shows its sha256 only)."),
    }
    return block


def instructions_line(block: dict | None) -> str | None:
    """One line for a terminal summary, or None."""
    if not block:
        return None
    parts = []
    if block.get("coaching"):
        sha = block.get("coaching_sha256") or ""
        parts.append(f"coaching {block['coaching']}"
                     + (f" (sha256 {sha[:12]}…)" if sha else ""))
    if block.get("system_prompt_sha256"):
        chars = block.get("system_prompt_chars")
        parts.append(f"system prompt "
                     + (f"{chars:,} chars, " if chars else "")
                     + f"sha256 {block['system_prompt_sha256'][:12]}…")
    if not parts:
        return None
    if block.get("builtin_prompt"):
        return (", ".join(parts) + " — the harness's built-in prompt: \""
                + " ".join(str(block["builtin_prompt"]).split()) + "\"")
    return (", ".join(parts) + f" — full text: {block['full_text_in']} "
            f"({' / '.join(block['full_text_keys'])})")


# ---------------------------------------------------------------------------
# Aggregation helpers
# ---------------------------------------------------------------------------

def _aggregate_segment_metrics(entries: list[EntryMetrics]) -> dict[str, SegmentMetrics]:
    """Group entries by segment and compute aggregates."""
    groups: dict[str, list[EntryMetrics]] = defaultdict(list)
    for em in entries:
        groups[em.segment or "unknown"].append(em)

    result = {}
    for key, items in groups.items():
        result[key] = _aggregate_group(str(key), items)
    return result


def _aggregate_difficulty_metrics(entries: list[EntryMetrics]) -> dict[int, SegmentMetrics]:
    """Group entries by difficulty level and compute aggregates."""
    groups: dict[int, list[EntryMetrics]] = defaultdict(list)
    for em in entries:
        groups[em.difficulty].append(em)

    result = {}
    for key, items in groups.items():
        result[key] = _aggregate_group(f"difficulty_{key}", items)
    return result


def _aggregate_domain_metrics(entries: list[EntryMetrics]) -> dict[str, SegmentMetrics]:
    """Group entries by domain and compute aggregates.

    Entries without a domain field go into the '' (empty string) group.
    No silent fallback — missing domain stays empty, not a default code.
    """
    groups: dict[str, list[EntryMetrics]] = defaultdict(list)
    for em in entries:
        groups[em.domain].append(em)

    result = {}
    for key, items in groups.items():
        result[key] = _aggregate_group(key or "(no domain)", items)
    return result


def _aggregate_group(name: str, items: list[EntryMetrics]) -> SegmentMetrics:
    """Compute aggregate metrics for a group of entries."""
    sm = SegmentMetrics(name=name, count=len(items))

    chrf_sum = 0.0
    bleu_sum = 0.0
    latency_sum = 0.0
    non_error_count = 0

    for em in items:
        if em.error:
            sm.error_count += 1
            continue

        non_error_count += 1
        latency_sum += em.latency_s
        # Free / consumer-MT engines report cost_usd=None (no token price) —
        # treat as 0 for the sum so a free run can still be scored.
        sm.total_cost_usd += em.cost_usd or 0.0

        if em.exact_match:
            sm.exact_match_count += 1
        else:
            sm.miss_count += 1

        chrf_sum += (em.chrf_score or 0.0)
        bleu_sum += (em.bleu_score or 0.0)

    if non_error_count > 0:
        sm.avg_chrf = round(chrf_sum / non_error_count, 2)
        sm.avg_bleu = round(bleu_sum / non_error_count, 2)
        sm.avg_latency_s = round(latency_sum / non_error_count, 6)

    priced = [em for em in items if not em.error and em.cost_usd is not None]
    sm.total_cost_usd = (round(sm.total_cost_usd, 4) if priced or not items
                         else None)
    return sm


def _compute_overall(entries: list[EntryMetrics]) -> dict:
    """Compute overall aggregate metrics."""
    total = len(entries)
    errors = sum(1 for em in entries if em.error)
    non_error = [em for em in entries if not em.error]
    n = len(non_error)

    exact = sum(1 for em in non_error if em.exact_match)

    overall = {
        "total_entries": total,
        "error_count": errors,
        "evaluated": n,
        "exact_match_count": exact,
        "exact_match_rate": round(exact / n, 4) if n else 0.0,
        "miss_count": n - exact,
        "miss_rate": round((n - exact) / n, 4) if n else 0.0,
    }

    if n:
        chrf_values = [em.chrf_score for em in non_error if em.chrf_score is not None]
        bleu_values = [em.bleu_score for em in non_error if em.bleu_score is not None]
        overall["avg_chrf"] = round(sum(chrf_values) / len(chrf_values), 2) if chrf_values else 0.0
        overall["avg_bleu"] = round(sum(bleu_values) / len(bleu_values), 2) if bleu_values else 0.0
        # 6 decimals: a forge model decoding 3.4 ms per sentence, or a fast
        # local endpoint's per-entry share of a batch, must not round to the
        # 0.0 a run with no timing shows (Round 12; run_card.latency_reading).
        overall["avg_latency_s"] = round(
            sum(em.latency_s for em in non_error) / n, 6
        )
        # Actual spend this run; cache hits carry their ORIGINAL price in
        # cached_cost_usd so cached reruns are visibly ~$0 actual.
        # Actual spend this run. When NO entry that hit the model carries a
        # price (a local / self-hosted / unpriced model), the total is UNKNOWN
        # — None, never $0: a fabricated $0 wins every cost comparison and
        # misstates what the run cost (the local provider's own contract).
        # The same all-or-nothing rule as the RunLog (pipeline.
        # enrich_results): when no entry carries a price, the total is
        # unknown — also for a rerun the cache served entirely, which used
        # to record $0 here while its RunLog said None (compare then showed
        # "$0.0000" beside "unknown" for two runs of one local model —
        # synthetic researcher, Round 6).
        billed = [em for em in non_error if not em.cached]
        if all(em.cost_usd is None for em in (billed or non_error)):
            overall["total_cost_usd"] = None
            overall["cost_unknown"] = True
        else:
            overall["total_cost_usd"] = round(
                sum((em.cost_usd or 0.0) for em in billed), 4
            )
        overall["cached_cost_usd"] = round(
            sum((em.cost_usd or 0.0) for em in non_error if em.cached), 4
        )
        overall["cached_entries"] = sum(1 for em in non_error if em.cached)
        overall["total_tool_calls"] = sum(em.tool_call_count for em in non_error)

    return overall


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def _print_summary(
    overall: dict,
    segments: dict,
    difficulties: dict,
    domains: dict,
    output_path: Path,
    config: dict | None = None,
    caveats: list[dict] | None = None,
    provenance: dict | None = None,
    cost_text: str | None = None,
    composite_line: bool = True,
):
    """Print human-readable summary to console.

    Args:
        config: Optional run config dict. When present, quality-affecting
                parameters are printed at the top of the summary so users
                can verify what settings produced these scores.
        caveats: score_caveats.collect() for this report — printed right
                under the headline scores they qualify.
        cost_text: run_card.run_cost_label() for this run — the words every
                other surface uses for its cost.
    """
    print("\n" + "=" * 60)
    print("TEST REPORT SUMMARY")
    print("=" * 60)

    # Surface quality-affecting parameters at the top of every report
    # so there's never ambiguity about what produced these scores.
    if config:
        model = config.get("model", config.get("_model_id", "unknown"))
        from mt_eval_harness.run_card import outputs_made_outside
        # A hypotheses file names the system that made it (contest qualify
        # --system), not a model the harness ran (Round 12 researcher).
        print(f"\n  {'System:' if outputs_made_outside(config) else 'Model:':<14} "
              f"{model}")
        # An engine that ran a model it was given: which one (Round 10 — the
        # summary named only "local-model", whichever weights produced it).
        from mt_eval_harness import engine_model as _em
        _engine = _em.from_run(config)
        if _engine:
            print(f"  Engine model:  {_em.label(_engine)}")
        elif _em.engine_requires_model(config):
            print("  Engine model:  NOT RECORDED — this run names no model")
        # Only the settings that applied (run_card.run_settings_rows): an
        # engine or plugin run shows its batch size and one "n/a" line, not
        # LLM settings it never used.
        from mt_eval_harness.run_card import run_settings_rows
        import textwrap as _tw
        for key, value in run_settings_rows(config):
            if key in ("Concurrency", "Tools"):
                continue   # the summary never listed these
            for i, part in enumerate(_tw.wrap(str(value), width=60) or [""]):
                print(f"  {(key + ':') if i == 0 else '':<14} {part}")
        tgt = config.get("target_lang", "")
        src = config.get("source_lang", "")
        if tgt:
            print(f"  Target lang:   {tgt}")
        if src:
            print(f"  Source lang:   {src}")

    n = overall["evaluated"]
    print(f"\n  Total entries:    {overall['total_entries']}")
    print(f"  Errors:           {overall['error_count']}")
    print(f"  Evaluated:        {n}")

    # --- The headline (scoring standard/1): corpus chrF++ with its 95%
    # bootstrap CI and sacreBLEU signature. Then the other standard metrics
    # beside it, never blended; then diagnostics, labelled as such.
    from mt_eval_harness.scoring import format_primary, primary_signature
    cis = overall.get("confidence_intervals", {})

    if "corpus_chrf" in overall:
        ci = cis.get("corpus_chrf") or {}
        print(f"\n  Headline:         "
              f"{format_primary(overall['corpus_chrf'], ci.get('ci_lower'), ci.get('ci_upper'))}"
              f"  (corpus, 0-100; 95% bootstrap CI)")
        sig = primary_signature(overall.get("sacrebleu_signatures"))
        if sig:
            print(f"  Signature:        {sig}")

    # Caveats right under the headline they qualify (score_caveats).
    if caveats:
        from mt_eval_harness.score_caveats import caveat_lines
        print()
        for line in caveat_lines(caveats, width=76, indent="  "):
            print(line)

    print("\n  Beside it (standard metrics, never blended):")
    if "corpus_bleu" in overall:
        ci = cis.get("corpus_bleu")
        if ci:
            print(f"  Corpus BLEU:      {overall['corpus_bleu']:.1f}  "
                  f"[{ci['ci_lower']:.1f} – {ci['ci_upper']:.1f}]")
        else:
            print(f"  Corpus BLEU:      {overall['corpus_bleu']:.1f}")

    # spBLEU (BLEU on the FLORES-200 SentencePiece tokenizer) — computed for
    # every run, printed nowhere until Round 7 (synthetic researcher).
    if "corpus_spbleu" in overall:
        sp = overall["corpus_spbleu"]
        print(f"  Corpus spBLEU:    {sp:.1f}" if isinstance(sp, (int, float))
              else "  Corpus spBLEU:    not computed (FLORES-200 tokenizer "
                   "unavailable)")

    if isinstance(overall.get("corpus_ter"), (int, float)):
        print(f"  Corpus TER:       {overall['corpus_ter']:.1f}  (lower is better)")

    if overall.get("comet_score") is not None:
        comet = overall["comet_score"]
        warning = " ⚠️ low-resource" if overall.get("comet_low_resource_warning") else ""
        model = f" ({overall['comet_model']})" if overall.get("comet_model") else ""
        ci = cis.get("comet")
        if ci:
            print(f"  COMET:            {comet:.4f}  "
                  f"[{ci['ci_lower']:.4f} – {ci['ci_upper']:.4f}]{model}{warning}")
        else:
            print(f"  COMET:            {comet:.4f}{model}{warning}")

    if overall.get("metricx_score") is not None:
        # LOWER is better (error score, 0–25) — the ↓ marks the direction so it is
        # never read like COMET/chrF++.
        metricx = overall["metricx_score"]
        qe = " (QE)" if overall.get("metricx_qe_mode") else ""
        warning = " ⚠️ low-resource" if overall.get("metricx_low_resource_warning") else ""
        ci = cis.get("metricx")
        if ci:
            print(f"  MetricX-24 ↓:     {metricx:.3f}  "
                  f"[{ci['ci_lower']:.3f} – {ci['ci_upper']:.3f}]  (lower=better, 0–25){qe}{warning}")
        else:
            print(f"  MetricX-24 ↓:     {metricx:.3f}  (lower=better, 0–25){qe}{warning}")

    print("\n  Diagnostics (reported separately; never in the headline):")
    print(f"  Exact match:      {overall['exact_match_count']}/{n} "
          f"({overall['exact_match_rate']:.1%})")
    if "exact_match_rate" in overall and cis.get("exact_match_rate"):
        ci = cis["exact_match_rate"]
        print(f"  Exact match CI:   [{ci['ci_lower']*100:.1f} – {ci['ci_upper']*100:.1f}%]")
    print(f"  Miss:             {overall['miss_count']}/{n} "
          f"({overall['miss_rate']:.1%})")

    # Terminology: the value WITH the counts it is computed from (it used to
    # print a mean that counted every term-free entry as 1.0).
    from mt_eval_harness.plugins.terminology import adherence_label
    term_label = adherence_label((overall.get("plugin_metrics") or {})
                                 .get("terminology"))
    if term_label:
        print(f"  Terminology:      {term_label}")

    if cost_text is None and (overall.get("total_cost_usd") is not None
                              or overall.get("cost_unknown")):
        from mt_eval_harness.run_card import cost_label
        cost_text = cost_label(overall.get("total_cost_usd"), config or {},
                               provenance or {})
    if cost_text:
        # The one cost rule (run_card.run_cost_label): the same words the
        # run summary, the run card, compare and the publish preview use.
        print(f"\n  Total cost:       {cost_text}")
    if overall.get("avg_latency_s"):
        from mt_eval_harness.run_card import latency_text
        print(f"  Avg latency:      {latency_text(overall['avg_latency_s'])}s")

    # Per-segment
    if len(segments) > 1:
        print(f"\n  {'Segment':<25s} {'Exact':>7s} {'chrF++':>7s}")
        print(f"  {'-'*25} {'-----':>7s} {'------':>7s}")
        for name, sm in sorted(segments.items()):
            print(
                f"  {name:<25s} "
                f"{sm.exact_match_rate:>6.1%} "
                f"{sm.avg_chrf:>7.1f}"
            )

    # Per-domain
    if len(domains) > 1:
        print(f"\n  {'Domain':<25s} {'Count':>6s} {'Exact':>7s} {'chrF++':>7s}")
        print(f"  {'-'*25} {'-----':>6s} {'-----':>7s} {'------':>7s}")
        for name, sm in sorted(domains.items()):
            print(
                f"  {(name or '(no domain)'):<25s} "
                f"{sm.count:>6d} "
                f"{sm.exact_match_rate:>6.1%} "
                f"{sm.avg_chrf:>7.1f}"
            )

    # Per-difficulty — shows how quality varies by translation complexity.
    # Difficulty levels are assigned by the corpus builder based on
    # word count, clause count, and average word length.
    DIFFICULTY_LABELS = {
        0: "Unrated",
        1: "Easy (Tier 1)",
        2: "Medium (Tier 2)",
        3: "Hard (Tier 3)",
        4: "Very Hard (Tier 4)",
        5: "Expert (Tier 5)",
    }
    # Only display if there are multiple difficulty levels
    # (a single level means the corpus has no difficulty annotations)
    if len(difficulties) > 1:
        # Check if per-tier CIs are available
        tier_cis = overall.get("confidence_intervals_by_tier", {})

        # chrF++* / BLEU* here are MEANS OF PER-SENTENCE scores (SegmentMetrics
        # avg_chrf / avg_bleu); the headline lines above are corpus-level.
        # Unlabelled, a 0.5 headline BLEU beside 10.2 for "Easy" read as a
        # contradiction (synthetic researcher + hospital, 2026-10-03). The CI
        # column is the tier's CORPUS chrF++ interval (confidence.py), so it
        # is named as such rather than sitting under the mean.
        header = f"\n  {'Difficulty':<25s} {'Count':>6s} {'Exact':>7s} {'chrF++*':>7s} {'BLEU*':>7s}"
        if tier_cis:
            header += f"  {'corpus chrF++ CI':>17s}"
        print(header)

        sep = f"  {'-'*25} {'-----':>6s} {'-----':>7s} {'------':>7s} {'----':>7s}"
        if tier_cis:
            sep += f"  {'-'*17}"
        print(sep)

        for level, sm in sorted(difficulties.items()):
            label = DIFFICULTY_LABELS.get(level, f"Tier {level}")
            line = (
                f"  {label:<25s} "
                f"{sm.count:>6d} "
                f"{sm.exact_match_rate:>6.1%} "
                f"{sm.avg_chrf:>7.1f} "
                f"{sm.avg_bleu:>7.1f}"
            )
            # Append CI if available for this tier
            tier_ci = tier_cis.get(str(level), {}).get("corpus_chrf")
            if tier_ci:
                line += f"  [{tier_ci['ci_lower']:.1f} – {tier_ci['ci_upper']:.1f}]"
            print(line)
        print("  * mean of per-sentence scores — a different statistic from the "
              "corpus chrF++/BLEU above; do not compare the two.")

    # Plugin metrics
    if "plugin_metrics" in overall:
        print(f"\n  Plugin Metrics:")
        for pname, pdata in overall["plugin_metrics"].items():
            print(f"    [{pname}]")
            if isinstance(pdata, dict):
                for k, v in pdata.items():
                    if isinstance(v, float):
                        print(f"      {k}: {v:.4f}")
                    else:
                        print(f"      {k}: {v}")

    if output_path:
        print(f"\n  Report:       {output_path}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# CLI entry
# ---------------------------------------------------------------------------

def run_test(
    log_path: str,
    output_path: str | None = None,
    metric_plugins: list | None = None,
    compute_ci: bool = True,
    n_bootstrap_ci: int = 1000,
    glossary_file: str | None = None,
):
    """CLI entry point for the test subcommand."""
    analyze_run(
        log_path,
        output_path,
        metric_plugins=metric_plugins,
        compute_ci=compute_ci,
        n_bootstrap_ci=n_bootstrap_ci,
        glossary_file=glossary_file,
    )
