"""
GiellaLT FST Metric — Generic morphological validity checker for any
language with a GiellaLT finite-state transducer.

This plugin satisfies the MetricPlugin protocol (name, compute, aggregate)
and works with any language whose .hfstol analyzer is installed locally.

HOW IT WORKS:
    For each predicted translation, the plugin:
    1. Tokenizes the output into words (whitespace split)
    2. Runs each word through the FST analyzer
    3. A word is "valid" if the analyzer returns at least one analysis
    4. Reports per-entry validity rate and corpus-level average

WHY THIS MATTERS:
    For polysynthetic languages like Plains Cree, a single misplaced
    morpheme makes a word form invalid. chrF++ and BLEU can't catch
    this — they measure surface character overlap, not morphological
    well-formedness. The FST is ground truth for word validity.

RELATIONSHIP TO CrkFSTMetric:
    This generic plugin supersedes CrkFSTMetric for evaluation purposes.
    CrkFSTMetric used CrkGenerator (which wraps pyhfst with hardcoded
    CRK paths). This plugin uses pyhfst directly with configurable paths,
    making it language-agnostic while producing identical results for CRK.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# Coverage floor for morphological_accuracy. Below this fraction of analyzable
# predicted words being lemma-matched to the reference, the metric is too sparse
# to be meaningful — publish.py reports morph_coverage but leaves
# morphological_accuracy out of the composite (None) rather than score a
# misleading number. (Disclosed, never silently filled.)
MORPH_COVERAGE_FLOOR = 0.25


def parse_giellalt_analysis(analysis: str) -> tuple[str, frozenset[str]]:
    """Parse a GiellaLT analysis string into (lemma, frozenset(tags)).

    GiellaLT analyses are ``lemma+Tag1+Tag2+…`` (the lemma first, then ``+``-
    separated morphological feature tags). The lemma is the lexical root; the
    tags are the inflection. This format is shared across GiellaLT languages, so
    morphological_accuracy stays language-neutral. Returns ('', frozenset()) for
    an empty/degenerate analysis.
    """
    if not analysis:
        return "", frozenset()
    parts = analysis.split("+")
    lemma = parts[0]
    tags = frozenset(p for p in parts[1:] if p)
    return lemma, tags


class GiellaLTFSTMetric:
    """Generic FST morphological validity checker.

    Wraps pyhfst to analyze words through a GiellaLT FST transducer.
    Works for any language that has .hfstol files installed locally.

    Produces:
        Per-entry:
            - fst_total_words (int): Total words in predicted output
            - fst_valid_words (int): Words recognized by FST
            - fst_validity_rate (float): Valid / total
            - fst_invalid_words (list[str]): Words NOT recognized

        Aggregate:
            - avg_fst_validity (float): Mean validity rate across entries
            - total_words_checked (int): Total words checked
            - total_valid_words (int): Total valid words
            - corpus_validity_rate (float): Overall valid/total ratio
    """

    name = "giellalt_fst_validity"

    def __init__(self, lang_code: str, fst_dir: Path):
        """Initialize with a language code and FST directory.

        Args:
            lang_code: ISO 639-3 code (e.g. "crk", "sme")
            fst_dir: Path to directory containing .hfstol files
        """
        self.lang_code = lang_code
        self._fst_dir = fst_dir
        self._analyzer = None

    def _load_analyzer(self):
        """Lazy-load the FST analyzer transducer."""
        if self._analyzer is not None:
            return self._analyzer

        from mt_eval_harness.plugins.fst_installer import find_analyzer_hfstol

        analyzer_path = find_analyzer_hfstol(self._fst_dir)
        if analyzer_path is None:
            raise FileNotFoundError(
                f"No analyzer .hfstol found in {self._fst_dir}"
            )

        try:
            import pyhfst
        except ImportError:
            raise ImportError(
                "pyhfst is required for FST validation. "
                "Install with: pip install pyhfst"
            )

        input_stream = pyhfst.HfstInputStream(str(analyzer_path))
        self._analyzer = input_stream.read()
        logger.info("Loaded FST analyzer: %s", analyzer_path.name)
        return self._analyzer

    def _analyze_word(self, word: str) -> bool:
        """Check if a word is recognized by the FST analyzer.

        Returns True if the FST returns at least one analysis.
        """
        analyzer = self._load_analyzer()
        try:
            results = analyzer.lookup(word)
            return len(results) > 0
        except Exception as e:
            logger.warning("FST lookup error for word %r: %s", word, e)
            return False

    def _word_analyses(self, word: str) -> list[tuple[str, frozenset[str]]]:
        """FST-analyze a word → list of (lemma, tagset) candidates.

        Empty list if the word is pure punctuation or the FST returns no
        analysis (not analyzable). Used for morphological_accuracy.
        """
        clean = word.strip(".,;:!?\"'()[]{}—–-")
        if not clean:
            return []
        analyzer = self._load_analyzer()
        try:
            results = analyzer.lookup(clean)
        except Exception as e:
            logger.warning("FST lookup error for word %r: %s", word, e)
            return []
        return [parse_giellalt_analysis(r[0]) for r in results] if results else []

    def version_info(self) -> dict:
        """Installed-FST + pyhfst version metadata for run-card capture.

        Reads the provenance.json that ``fst_installer._write_provenance`` drops
        next to the .hfstol files (release tag, repo, sha256, format, maturity,
        installed_at) plus the installed pyhfst version, and names the analyzer
        file actually backing this metric. Every field is best-effort and nullable
        — a hand-copied FST with no provenance still yields a usable (mostly-null)
        block rather than an error. Follows the sacrebleu_signatures precedent:
        describes HOW the structural metric was computed so a published FST score
        can be traced to an exact transducer release.
        """
        info: dict = {
            "fst_release": None,
            "fst_repo": None,
            "fst_sha256": None,
            "fst_format": None,
            "fst_maturity": None,
            "fst_installed_at": None,
            "analyzer_file": None,
            "pyhfst_version": None,
        }
        try:
            from importlib.metadata import version as _pkg_version

            info["pyhfst_version"] = _pkg_version("pyhfst")
        except Exception:
            pass
        try:
            prov_path = Path(self._fst_dir) / "provenance.json"
            if prov_path.exists():
                prov = json.loads(prov_path.read_text(encoding="utf-8"))
                info["fst_release"] = prov.get("release_tag") or None
                info["fst_repo"] = prov.get("repo") or None
                info["fst_sha256"] = prov.get("sha256") or None
                info["fst_format"] = prov.get("format") or None
                info["fst_maturity"] = prov.get("maturity") or None
                info["fst_installed_at"] = prov.get("installed_at") or None
        except Exception:
            pass
        try:
            from mt_eval_harness.plugins.fst_installer import find_analyzer_hfstol

            analyzer = find_analyzer_hfstol(Path(self._fst_dir))
            if analyzer is not None:
                info["analyzer_file"] = analyzer.name
        except Exception:
            pass
        return info

    def compute(self, entry: dict) -> dict:
        """Check FST validity for each word in the prediction.

        Follows the MetricPlugin protocol:
            entry must have a "predicted" key with the translation string.
        """
        predicted = entry.get("predicted", "").strip()

        if not predicted:
            return {
                "fst_total_words": 0,
                "fst_valid_words": 0,
                "fst_validity_rate": 0.0,
                "fst_invalid_words": [],
            }

        words = predicted.split()
        total = len(words)
        valid = 0
        invalid_words = []

        for word in words:
            # Strip punctuation from word edges before analysis.
            # FSTs expect clean word forms without trailing periods, commas, etc.
            clean = word.strip(".,;:!?\"'()[]{}—–-")
            if not clean:
                # Pure punctuation — skip (don't count as invalid)
                total -= 1
                continue

            if self._analyze_word(clean):
                valid += 1
            else:
                invalid_words.append(clean)

        result = {
            "fst_total_words": total,
            "fst_valid_words": valid,
            "fst_validity_rate": valid / max(total, 1),
            "fst_invalid_words": invalid_words,
        }

        # --- morphological_accuracy (FST-derived, LEMMA-matched) ---
        # For each analyzable predicted word, look for a reference word sharing
        # its LEMMA (root). Among those (COVERED) the inflection is CORRECT if the
        # predicted tagset matches a reference tagset for that lemma. Matching by
        # lemma — not position — means a mis-aligned or different-word-choice pair
        # simply isn't covered (never falsely scored). Words the FST can't analyze,
        # or whose root isn't in the reference, are out of coverage (disclosed).
        expected = entry.get("expected", "").strip()
        morph_analyzable = 0
        morph_covered = 0
        morph_correct = 0
        if predicted and expected:
            ref_index: dict[str, set[frozenset[str]]] = {}
            for rw in expected.split():
                for lemma, tags in self._word_analyses(rw):
                    if lemma:
                        ref_index.setdefault(lemma, set()).add(tags)
            for pw in predicted.split():
                cands = self._word_analyses(pw)
                if not cands:
                    continue  # not analyzable → out of coverage (fst validity covers this)
                morph_analyzable += 1
                covered = False
                correct = False
                for lemma, tags in cands:
                    if lemma in ref_index:
                        covered = True
                        if tags in ref_index[lemma]:
                            correct = True
                            break
                if covered:
                    morph_covered += 1
                    if correct:
                        morph_correct += 1
        result["morph_analyzable_words"] = morph_analyzable
        result["morph_covered_words"] = morph_covered
        result["morph_correct_words"] = morph_correct

        return result

    def aggregate(self, entry_results: list[dict]) -> dict:
        """Compute corpus-level FST validity statistics.

        Reports both micro-average (corpus-wide word ratio) and
        macro-average (mean of per-entry rates).

        Filters out error entries (e.g., from pyhfst not being installed).
        """
        # Filter out entries that errored during compute()
        valid_results = [r for r in entry_results if "error" not in r]

        if not valid_results:
            # No entry could be FST-analyzed. This is the FST-UNAVAILABLE case
            # (pyhfst missing, transducer not installed, or no entries) — NOT a
            # measured 0% validity. Returning 0.0 here would publish a
            # fabricated "0% morphologically valid" score AND flip has_fst=True
            # (publish.py treats a present, error-free fst_data as measured).
            # Fail honest: carry an `error` so publish skips this metric, the
            # composite uses the no-FST profile, and the run reports "FST not
            # measured" instead of an invented, damning 0.0.
            errored = [r for r in entry_results if "error" in r]
            reason = "FST unavailable: no entries were analyzed"
            if errored:
                reason = f"FST unavailable: {errored[0].get('error')}"
            return {
                "avg_fst_validity": None,
                "corpus_validity_rate": None,
                "total_words_checked": 0,
                "total_valid_words": 0,
                "error": reason,
            }

        # Macro-average: mean of per-entry validity rates
        rates = [r["fst_validity_rate"] for r in valid_results]
        avg_validity = sum(rates) / len(rates)

        # Micro-average: total valid / total words across all entries
        total_words = sum(r["fst_total_words"] for r in valid_results)
        total_valid = sum(r["fst_valid_words"] for r in valid_results)
        corpus_rate = total_valid / max(total_words, 1)

        # --- morphological_accuracy aggregate (FST-derived, lemma-matched) ---
        m_analyzable = sum(r.get("morph_analyzable_words", 0) for r in valid_results)
        m_covered = sum(r.get("morph_covered_words", 0) for r in valid_results)
        m_correct = sum(r.get("morph_correct_words", 0) for r in valid_results)
        morph_accuracy = (m_correct / m_covered) if m_covered > 0 else None
        morph_coverage = (m_covered / m_analyzable) if m_analyzable > 0 else 0.0

        return {
            "avg_fst_validity": avg_validity,
            # FST release + pyhfst version (sacrebleu_signatures precedent) — carried
            # into the run card by publish.py as fst_version / fst_provenance.
            "fst_version_info": self.version_info(),
            "total_words_checked": total_words,
            "total_valid_words": total_valid,
            "corpus_validity_rate": corpus_rate,
            # Morphological accuracy (FST-derived, lemma-matched). None when no
            # words were covered. morph_coverage = fraction of analyzable predicted
            # words lemma-matched to the reference; publish.py applies
            # MORPH_COVERAGE_FLOOR and reports coverage transparently (never fills
            # a misleading number below the floor).
            "morphological_accuracy": (
                round(morph_accuracy, 4) if morph_accuracy is not None else None
            ),
            "morph_coverage": round(morph_coverage, 4),
            "morph_covered_words": m_covered,
            "morph_analyzable_words": m_analyzable,
        }
