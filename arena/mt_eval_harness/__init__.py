"""
mt-eval — A configurable, language-agnostic evaluation
harness for machine translation pipelines.

Two-component architecture:
    Run Harness:  Executes translation experiments with configurable
                  model, prompt, tools, batching, and caching.
    Test Harness: Analyzes run results offline with deterministic
                  linguistic metrics (chrF++, BLEU, COMET, exact match),
                  bootstrap confidence intervals, significance testing,
                  and extensible plugin metrics.

Any translation method can plug into the harness for regularized,
apple-to-apple comparison. See GUIDE.md for full documentation.
"""

__version__ = "0.1.0"

# Public API — importable from the top-level package
from mt_eval_harness.config import (
    RunConfig,
    load_registry,
    resolve_dataset,
    load_method_card,
    validate_method_card,
)
from mt_eval_harness.exporter import ExportConfig, export_plugin
from mt_eval_harness.corpus_loader import load_corpus
from mt_eval_harness.champollion_config import (
    ChampollionRunConfig,
    ChampollionPromptConfig,  # Back-compat alias for ChampollionRunConfig
    load_champollion_config,
    build_champollion_system_prompt,
)
from mt_eval_harness.plugins.metrics import MetricPlugin
from mt_eval_harness.plugins.prompts import PromptProvider
from mt_eval_harness.plugins.champollion_prompts import ChampollionPromptProvider
from mt_eval_harness.plugins.hooks import PostTranslationHook
from mt_eval_harness.plugins.tools import ToolProvider
from mt_eval_harness.significance import (
    SignificanceResult,
    paired_bootstrap,
    paired_approximate_randomization,
)
from mt_eval_harness.confidence import ConfidenceInterval, bootstrap_ci, compute_all_cis
from mt_eval_harness.metrics_comet import (
    HAS_COMET,
    COMETResult,
    compute_comet,
    corpus_comet,
    DEFAULT_COMET_MODEL,
    resolve_comet_model,
)
from mt_eval_harness.metrics_metricx import (
    HAS_METRICX,
    MetricXResult,
    compute_metricx,
    corpus_metricx,
    DEFAULT_METRICX_MODEL,
    METRICX_LOWER_IS_BETTER,
)

__all__ = [
    "RunConfig",
    "ExportConfig",
    "export_plugin",
    "load_corpus",
    "ChampollionRunConfig",
    "ChampollionPromptConfig",  # Back-compat alias
    "load_champollion_config",
    "build_champollion_system_prompt",
    "ChampollionPromptProvider",
    "MetricPlugin",
    "PromptProvider",
    "PostTranslationHook",
    "ToolProvider",
    "SignificanceResult",
    "paired_bootstrap",
    "paired_approximate_randomization",
    "ConfidenceInterval",
    "bootstrap_ci",
    "compute_all_cis",
    "HAS_COMET",
    "COMETResult",
    "compute_comet",
    "corpus_comet",
    "DEFAULT_COMET_MODEL",
    "resolve_comet_model",
    "HAS_METRICX",
    "MetricXResult",
    "compute_metricx",
    "corpus_metricx",
    "DEFAULT_METRICX_MODEL",
    "METRICX_LOWER_IS_BETTER",
    "load_registry",
    "resolve_dataset",
    "load_method_card",
    "validate_method_card",
]
