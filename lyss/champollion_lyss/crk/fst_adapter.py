"""
FST Adapter — Thin wrapper around pyhfst for LYSS eval standards.

Replaces CrkGenerator as the FST interface for evaluation code.
Uses the harness's own FST cache infrastructure instead of
CrkGenerator's hardcoded paths.

WHY THIS EXISTS:
    LYSS (linter.py, semantic_validator.py) originally imported
    CrkGenerator from crk-translate — a translation method.
    Evaluation standards must not depend on any contestant's code.
    This adapter provides the same .analyze() interface using the
    harness's own pyhfst + fst_installer infrastructure.

INTERFACE CONTRACT:
    The linter and semantic_validator expect:
        result = analyzer.analyze(word)
        result.success     → bool
        result.analyses    → list[str]  (FST analysis strings)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result dataclass — matches CrkGenerator's AnalysisResult interface
# ---------------------------------------------------------------------------

@dataclass
class AnalysisResult:
    """Result of FST morphological analysis for a single word.

    Mirrors the interface of crk_translate.generator.AnalysisResult
    so existing eval code works without changes.
    """
    word: str
    success: bool
    analyses: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# FST Analyzer
# ---------------------------------------------------------------------------

class FSTAnalyzer:
    """Thin pyhfst wrapper using the harness's FST cache.

    Provides the same .analyze(word) interface as CrkGenerator
    but loads FSTs from ~/.mt-eval/fsts/{lang_code}/ via the
    harness's fst_installer module.

    Args:
        lang_code: ISO 639-3 code (e.g., "crk")
    """

    def __init__(self, lang_code: str = "crk"):
        self.lang_code = lang_code
        self._analyzer = None

    def is_available(self) -> bool:
        """Return True if an FST analyzer for this language is installed.

        Delegates to the harness FST installer's ``is_fst_installed`` (the FST is
        fetched on demand by the harness, never bundled here). Returns False
        cleanly when the harness or the FST is absent — the semantic metric uses
        this to fail honestly (report the verdict as unavailable) rather than
        scoring with no morphological analysis at all.
        """
        try:
            from mt_eval_harness.plugins.fst_installer import is_fst_installed

            return bool(is_fst_installed(self.lang_code))
        except Exception:
            return False

    def _load(self):
        """Lazy-load the FST analyzer transducer."""
        if self._analyzer is not None:
            return self._analyzer

        from mt_eval_harness.plugins.fst_installer import (
            get_fst_cache_dir,
            find_analyzer_hfstol,
        )

        fst_dir = get_fst_cache_dir(self.lang_code)
        analyzer_path = find_analyzer_hfstol(fst_dir)

        if analyzer_path is None:
            raise FileNotFoundError(
                f"No FST analyzer found for '{self.lang_code}' "
                f"in {fst_dir}. Run: mt-eval setup --lang {self.lang_code}"
            )

        try:
            import pyhfst
        except ImportError:
            raise ImportError(
                "pyhfst is required for FST-based evaluation. "
                "Install with: pip install pyhfst"
            )

        input_stream = pyhfst.HfstInputStream(str(analyzer_path))
        self._analyzer = input_stream.read()
        logger.info(
            "LYSS FST adapter: loaded %s for %s",
            analyzer_path.name, self.lang_code,
        )
        return self._analyzer

    def analyze(self, word: str) -> AnalysisResult:
        """Analyze a surface form through the FST.

        Returns an AnalysisResult with .success and .analyses.
        Each analysis string is in the GiellaLT format:
            e.g., "PV/e+nipâw+V+AI+Cnj+3Sg"
        """
        try:
            analyzer = self._load()
            results = analyzer.lookup(word)
            # pyhfst returns list of (analysis_string, weight) tuples
            analyses = [r[0] for r in results] if results else []
            return AnalysisResult(
                word=word,
                success=len(analyses) > 0,
                analyses=analyses,
            )
        except FileNotFoundError:
            # FST not installed — return empty result
            return AnalysisResult(word=word, success=False, analyses=[])
        except Exception as e:
            logger.warning("FST analysis error for %r: %s", word, e)
            return AnalysisResult(word=word, success=False, analyses=[])
