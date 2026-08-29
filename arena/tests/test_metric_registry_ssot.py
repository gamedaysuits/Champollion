"""
SSOT parity guard for METRIC IDENTITY: scoring.py weight tables and the run-card
scores keys minted by publish.py must not drift from the shared metric-identity
manifest (shared/metric-registry.json), the one place that maps a canonical
metric id to its Python plugin name, language-card evalMetrics key, and run_cards
DB column.

Modeled on test_scoring_ssot.py + test_method_registry_ssot.py. Skips cleanly in
a standalone pip install where shared/ isn't present — the manifest is a monorepo
dev/CI guard, not a runtime dependency.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness.metric_manifest import (
    load_metric_manifest,
    metric_entries,
    metric_ids,
)
from mt_eval_harness.scoring import (
    INACTIVE_METRICS,
    NEURAL_METRICS,
    PROFILE_REGISTRY,
)

_ARENA_DIR = Path(__file__).resolve().parent.parent


def _require_manifest():
    manifest = load_metric_manifest()
    if manifest is None:
        pytest.skip("shared/metric-registry.json not found (standalone install)")
    return manifest


# ---------------------------------------------------------------------------
# Shape
# ---------------------------------------------------------------------------

def test_manifest_loads_and_is_shaped():
    manifest = _require_manifest()
    assert manifest.get("version"), "manifest must declare a version"
    entries = manifest.get("entries")
    assert isinstance(entries, dict) and entries
    _REQUIRED = {
        "category", "status", "display_name", "plugin_name", "card_key",
        "db_column", "scale", "direction", "level", "in_composite",
        "verifier_reproducible",
    }
    for name, entry in entries.items():
        missing = _REQUIRED - set(entry)
        assert not missing, f"{name}: entry missing required fields {sorted(missing)}"
        assert entry["direction"] in {"higher", "lower", "neutral"}, name
        assert entry["level"] in {"entry", "corpus", "both"}, name
        assert isinstance(entry["in_composite"], bool), name
        assert isinstance(entry["verifier_reproducible"], bool), name


# ---------------------------------------------------------------------------
# scoring.py → registry (the core drift guard)
# ---------------------------------------------------------------------------

def test_every_scoring_weight_key_is_registered():
    """Every metric named in any profile weight table resolves to a registry id."""
    _require_manifest()
    ids = metric_ids()
    for profile_name, weights in PROFILE_REGISTRY.items():
        for metric_name in weights:
            assert metric_name in ids, (
                f"scoring profile {profile_name!r} weights metric {metric_name!r}, "
                f"which is NOT in shared/metric-registry.json. Add it to the registry."
            )


def test_inactive_and_neural_metrics_are_registered():
    """INACTIVE_METRICS (declared-but-not-scoring) and NEURAL_METRICS (reported
    separately) must also be known to the registry — they are real metrics."""
    _require_manifest()
    ids = metric_ids()
    for metric_name in INACTIVE_METRICS | NEURAL_METRICS:
        assert metric_name in ids, (
            f"{metric_name!r} is in scoring.INACTIVE_METRICS/NEURAL_METRICS but not "
            f"in shared/metric-registry.json."
        )


def test_in_composite_flag_matches_scoring():
    """A registry entry's in_composite flag must match scoring.py exactly.

    'Effectively composite-able' = appears in some profile weight table AND is
    not declared-inactive AND is not neural. The registry's in_composite=true set
    must equal that set, so neither can drift without the other failing.
    """
    _require_manifest()
    composite_effective = set()
    for weights in PROFILE_REGISTRY.values():
        composite_effective |= set(weights)
    composite_effective -= set(INACTIVE_METRICS)
    composite_effective -= set(NEURAL_METRICS)

    registry_in_composite = {
        mid for mid, e in metric_entries().items() if e.get("in_composite")
    }
    assert registry_in_composite == composite_effective, (
        "registry in_composite flags drifted from scoring.py.\n"
        f"  registry says composite: {sorted(registry_in_composite)}\n"
        f"  scoring.py says composite: {sorted(composite_effective)}\n"
        f"  only in registry: {sorted(registry_in_composite - composite_effective)}\n"
        f"  only in scoring: {sorted(composite_effective - registry_in_composite)}"
    )


# ---------------------------------------------------------------------------
# publish.py score keys → registry
# ---------------------------------------------------------------------------

# Keys that appear in run_card["scores"]/["totals"] but are NOT metrics: counts,
# boolean flags, model-id strings, breakdown dicts, signatures, and other
# metadata ABOUT metrics. Everything else in those blocks MUST resolve to a
# registry id — so adding a new metric-bearing key forces a conscious
# registry-or-allowlist decision (that is the guard).
_NON_METRIC_SCORES_KEYS = frozenset({
    # counts
    "total", "evaluated", "errors",
    "exact_matches", "equivalent_matches", "fst_accepted",
    # flags / metadata about a metric
    "morph_in_composite", "scoring_profile",
    "has_references",
    "comet_model", "comet_low_resource_warning",
    "qe_model",
    "metricx_model", "metricx_lower_is_better", "metricx_score_max",
    "metricx_qe_mode", "metricx_low_resource_warning",
    # sidecar detail (companions to a metric, not metrics themselves)
    "sacrebleu_signatures", "fuse_components", "fuse_untrained",
    # breakdowns
    "by_difficulty", "by_domain", "by_provenance", "by_segment",
    "confidence_intervals",
    # the new null-metric disclosure block (task 3) — metadata, not a metric
    "metric_availability",
})

_NON_METRIC_TOTALS_KEYS = frozenset({
    "prompt_tokens", "completion_tokens", "reasoning_tokens", "cached_tokens",
    "cached_cost_usd",
})


def _assemble_minimal_card(tmp_path, monkeypatch):
    """Build a run card from a minimal RunLog+TestReport pair (mirrors the
    test_publish fixtures) so we can read the exact scores/totals keys publish.py
    mints — without a network call."""
    from mt_eval_harness import publish
    monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)

    run_log = {
        "run_id": "ssot_run",
        "harness_version": "9.0.0",
        "timestamp_start": "2026-01-01T00:00:00Z",
        "elapsed_s": 12.5,
        "total_cost_usd": 0.01,
        "cache_hits": 0,
        "config": {
            "model": "test-provider/test-model",
            "prompt_version": "v1",
            "temperature": 0.0,
            "max_tokens": 1024,
            "batch_size": 25,
            "dataset_id": "test_dataset",
            "source_lang": "English",
            "target_lang": "French",
            "tools_enabled": False,
        },
        "provenance": {
            "corpus_sha256": "a" * 64,
            "system_prompt_sha256": "b" * 64,
            "system_prompt_used": "Translate the following.",
            "dataset_meta": {"version": "1.0"},
        },
        "results": [
            {
                "id": 0, "source": "Hello.", "expected": "Bonjour.",
                "predicted": "Bonjour.", "latency_s": 0.5,
                "usage": {"prompt_tokens": 100, "completion_tokens": 10},
                "error": None,
            },
            {
                "id": 1, "source": "Thank you.", "expected": "Merci.",
                "predicted": "Merci beaucoup.", "latency_s": 0.3,
                "usage": {"prompt_tokens": 80, "completion_tokens": 8},
                "error": None,
            },
        ],
    }
    report = {
        "source_log": "",
        "overall": {
            "total_entries": 2, "evaluated": 2, "exact_match_count": 1,
            "exact_match_rate": 0.5, "corpus_chrf": 55.0, "corpus_bleu": 30.0,
            "corpus_ter": 40.0, "corpus_spbleu": 28.0, "corpus_chrf_plain": 52.0,
            "avg_length_ratio": 1.1, "error_count": 0, "plugin_metrics": {},
        },
        "by_difficulty": {}, "by_domain": {}, "by_segment": {}, "entries": [],
    }

    tmp_path.mkdir(parents=True, exist_ok=True)
    run_log_path = tmp_path / "ssot_run.json"
    run_log_path.write_text(json.dumps(run_log), encoding="utf-8")
    report["source_log"] = str(run_log_path)
    report_path = tmp_path / "ssot_run_report.json"
    report_path.write_text(json.dumps(report), encoding="utf-8")

    run_card, _, _ = publish.assemble_run_card(report_path)
    return run_card


def test_publish_scores_keys_resolve_against_registry(tmp_path, monkeypatch):
    _require_manifest()
    ids = metric_ids()
    run_card = _assemble_minimal_card(tmp_path, monkeypatch)

    unknown = []
    for key in run_card.get("scores", {}):
        if key in _NON_METRIC_SCORES_KEYS or key in ids:
            continue
        unknown.append(key)
    assert not unknown, (
        f"publish.py mints run_card['scores'] key(s) {unknown} that are neither a "
        f"registry metric id nor in _NON_METRIC_SCORES_KEYS. If it's a metric, add "
        f"it to shared/metric-registry.json; if metadata, add it to the allowlist."
    )


def test_publish_totals_keys_resolve_against_registry(tmp_path, monkeypatch):
    _require_manifest()
    ids = metric_ids()
    run_card = _assemble_minimal_card(tmp_path, monkeypatch)

    unknown = []
    for key in run_card.get("totals", {}):
        if key in _NON_METRIC_TOTALS_KEYS or key in ids:
            continue
        unknown.append(key)
    assert not unknown, (
        f"publish.py mints run_card['totals'] key(s) {unknown} that are neither a "
        f"registry metric id nor in _NON_METRIC_TOTALS_KEYS."
    )


def test_registered_metrics_are_produced_or_declared(tmp_path, monkeypatch):
    """Cross-check the other direction for the metrics we CAN observe on a minimal
    reference-based run: every registry metric whose db_column is non-null and
    whose status is 'implemented' AND which is deterministic surface/cost/speed
    should surface as a scores/totals/top-level key. This catches a registry
    entry whose canonical id no longer matches what publish emits."""
    _require_manifest()
    run_card = _assemble_minimal_card(tmp_path, monkeypatch)
    present = (
        set(run_card.get("scores", {}))
        | set(run_card.get("totals", {}))
        | set(run_card)  # top-level (e.g. corpus_bleu, elapsed_seconds)
    )
    # These surface unconditionally on any non-vacuous reference-based run.
    _EXPECTED_ALWAYS = {
        "exact_match_rate", "chrf_plus_plus", "ter", "length_ratio",
        "spbleu", "chrf_plain", "composite", "quality_tier",
        "avg_latency_seconds", "median_latency_seconds", "p95_latency_seconds",
        "total_cost_usd", "cost_per_entry_usd", "elapsed_seconds",
    }
    missing = _EXPECTED_ALWAYS - present
    assert not missing, (
        f"registry declares {sorted(missing)} but publish.py did not emit them on a "
        f"minimal reference-based run — canonical id may have drifted from the key."
    )
    # 'bleu' is emitted under the top-level 'corpus_bleu' key (its db_column).
    assert "corpus_bleu" in run_card, "publish.py no longer emits corpus_bleu"


# ---------------------------------------------------------------------------
# db_column existence in the schema doc
# ---------------------------------------------------------------------------

def test_db_columns_exist_in_schema_doc():
    """Every non-null db_column must appear in arena/DATABASE_SCHEMA.md's
    run_cards table (catches a typo'd or renamed column)."""
    _require_manifest()
    schema_doc = _ARENA_DIR / "DATABASE_SCHEMA.md"
    if not schema_doc.exists():
        pytest.skip("DATABASE_SCHEMA.md not present")
    text = schema_doc.read_text(encoding="utf-8")
    for mid, entry in metric_entries().items():
        col = entry.get("db_column")
        if not col:
            continue
        assert f"`{col}`" in text, (
            f"registry entry {mid!r} declares db_column {col!r} but that column is "
            f"not documented in arena/DATABASE_SCHEMA.md (run_cards)."
        )


# ---------------------------------------------------------------------------
# plugin_name ↔ harness plugin classes
# ---------------------------------------------------------------------------

def test_harness_plugin_names_match_registry():
    """Each harness-shipped MetricPlugin's `name` attr must be the plugin_name of
    some registry entry — so renaming a plugin without updating the registry (or
    vice versa) fails here."""
    _require_manifest()
    registry_plugin_names = {
        e["plugin_name"] for e in metric_entries().values() if e.get("plugin_name")
    }

    from mt_eval_harness.plugins.code_switching import CodeSwitchingPlugin
    from mt_eval_harness.plugins.hallucination import HallucinationPlugin
    from mt_eval_harness.plugins.terminology import TerminologyPlugin
    from mt_eval_harness.plugins.writing_style import WritingStyleMetric
    from mt_eval_harness.plugins.double_pass_compliance import DoublePassCompliancePlugin
    from mt_eval_harness.plugins.giellalt_fst import GiellaLTFSTMetric

    harness_names = {
        CodeSwitchingPlugin.name,
        HallucinationPlugin.name,
        TerminologyPlugin.name,
        WritingStyleMetric.name,
        DoublePassCompliancePlugin.name,
        GiellaLTFSTMetric.name,
    }
    for name in harness_names:
        assert name in registry_plugin_names, (
            f"harness plugin name {name!r} is not the plugin_name of any registry "
            f"entry — register it in shared/metric-registry.json."
        )


def test_lyss_plugin_names_match_registry_when_importable():
    """The CRK LYSS plugin names, when the (optional) lyss package is installed,
    must match the registry's plugin_name values."""
    _require_manifest()
    try:
        from champollion_lyss.crk.metrics import (
            CrkLinterMetric,
            CrkLintedChrF,
            CrkSemanticMetric,
        )
    except Exception:
        pytest.skip("champollion-lyss not installed (optional eval standard)")
    registry_plugin_names = {
        e["plugin_name"] for e in metric_entries().values() if e.get("plugin_name")
    }
    assert CrkLinterMetric.name in registry_plugin_names, CrkLinterMetric.name
    assert CrkSemanticMetric.name in registry_plugin_names, CrkSemanticMetric.name
    assert CrkLintedChrF.name in registry_plugin_names, CrkLintedChrF.name


def test_registry_plugin_names_are_accounted_for():
    """Every plugin_name in the registry must correspond to a real, importable
    MetricPlugin class (harness or the optional lyss package). Prevents a stale
    plugin_name lingering after a plugin is deleted."""
    _require_manifest()
    accounted = set()

    from mt_eval_harness.plugins.code_switching import CodeSwitchingPlugin
    from mt_eval_harness.plugins.hallucination import HallucinationPlugin
    from mt_eval_harness.plugins.terminology import TerminologyPlugin
    from mt_eval_harness.plugins.writing_style import WritingStyleMetric
    from mt_eval_harness.plugins.double_pass_compliance import DoublePassCompliancePlugin
    from mt_eval_harness.plugins.giellalt_fst import GiellaLTFSTMetric
    from mt_eval_harness.plugins.igt_gloss import IGTGlossMetric
    from mt_eval_harness.plugins.morph_segmentation import MorphSegmentationMetric
    accounted |= {
        CodeSwitchingPlugin.name, HallucinationPlugin.name, TerminologyPlugin.name,
        WritingStyleMetric.name, DoublePassCompliancePlugin.name, GiellaLTFSTMetric.name,
        IGTGlossMetric.name, MorphSegmentationMetric.name,
    }
    lyss_plugin_names = set()
    try:
        from champollion_lyss.crk.metrics import (
            CrkLinterMetric,
            CrkLintedChrF,
            CrkSemanticMetric,
        )
        accounted |= {CrkLinterMetric.name, CrkLintedChrF.name, CrkSemanticMetric.name}
    except Exception:
        # lyss optional — treat its declared plugin_names as accounted-for by
        # declaration (test_lyss_plugin_names_match_registry_when_importable
        # covers the case where it IS installed).
        lyss_plugin_names = {"crk_linter", "crk_linted_chrf", "crk_semantic"}
        accounted |= lyss_plugin_names

    registry_plugin_names = {
        e["plugin_name"] for e in metric_entries().values() if e.get("plugin_name")
    }
    orphan = registry_plugin_names - accounted
    assert not orphan, (
        f"registry declares plugin_name(s) {sorted(orphan)} with no importable "
        f"MetricPlugin class — remove them or fix the name."
    )
