"""
CRK Metric Plugins — LYSS evaluation standards for Plains Cree.

These are harness-level evaluation metrics, loaded via the language
card's evalMetrics declaration. They apply to ALL CRK translations
regardless of which method produced them.

Each plugin satisfies the MetricPlugin protocol:
    - name: str
    - compute(entry: dict) -> dict
    - aggregate(entry_results: list[dict]) -> dict

ARCHITECTURAL NOTE:
    Evaluation standards (referee) are deliberately separated from
    translation methods (contestants). The language card (crk.json)
    declares these metrics via evalMetrics, and plugin_discovery.py loads
    them generically — no hardcoded language knowledge in the harness.

RELATED:
    Word-level FST validity checking lives in the harness's generic
    GiellaLTFSTMetric (plugins/giellalt_fst.py), which does the same
    word-level FST validity checking for ANY language, not just CRK.
"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# CrkLinterMetric — Wraps linter.py's lint_translation()
# ---------------------------------------------------------------------------

class CrkLinterMetric:
    """Deterministic variant-class linter for Plains Cree translations.

    Detects known acceptable variant classes (word order, orthographic,
    optional particle, lemma synonym, progressive ambiguity, inclusive/
    exclusive) between a candidate and reference translation.

    Produces:
        Per-entry:
            - equivalent_match (bool): True if all differences are acceptable
            - variant_classes (list[str]): Detected variant class names
            - lint_verdict (str): EXACT | EQUIVALENT | MISS

        Aggregate:
            - equivalent_match_rate (float): Fraction of entries that are
              exact OR equivalent matches
            - variant_class_counts (dict): Count of each variant class
    """

    name = "crk_linter"

    def __init__(self):
        self._fst_available: Optional[bool] = None

    def _fst_ok(self) -> bool:
        """Is the FST installed? Cached. The linter still runs without it — only
        LEMMA_SYNONYM detection needs morphology — so this is reported as a
        transparency flag, not a hard gate (honest partial degradation)."""
        if self._fst_available is None:
            try:
                from champollion_lyss.crk.fst_adapter import FSTAnalyzer

                self._fst_available = FSTAnalyzer(lang_code="crk").is_available()
            except Exception:
                self._fst_available = False
        return self._fst_available

    def compute(self, entry: dict) -> dict:
        """Run the linter on a single entry."""
        from champollion_lyss.crk.linter import lint_translation

        predicted = entry.get("predicted", "").strip()
        expected = entry.get("expected", "").strip()

        if not predicted or not expected:
            return {
                "equivalent_match": False,
                "variant_classes": [],
                "lint_verdict": "NO_OUTPUT" if not predicted else "MISS",
                "fst_available": self._fst_ok(),
            }

        result = lint_translation(expected, predicted)

        return {
            "equivalent_match": result.equivalent_match,
            "variant_classes": result.variant_names,
            "lint_verdict": result.verdict,
            "fst_available": self._fst_ok(),
        }

    # Display metadata for the run-card renderer. The generic renderer
    # (run_card.py) shows any equivalence-linter plugin from these fields;
    # Cree-specific labels live HERE, in the LYSS lane, never in the
    # language-agnostic renderer (design rule: Cree is not special-cased
    # outside crk-translate and its custom linters).
    DISPLAY_NAME = "LYSS Equivalence Linter"
    VARIANT_LABELS = {
        "LONG_VOWEL_MACRON": "Long vowel diacritics (ā↔â)",
        "ORTHOGRAPHIC": "Preverb spacing (ê wâp↔ê-wâp)",
        "WORD_ORDER": "Word order permutation",
        "OPTIONAL_PARTICLE": "Optional particle (ispîhk…)",
        "LEMMA_SYNONYM": "Lemma synonym",
        "INCLUSIVE_EXCLUSIVE": "Inclusive/exclusive 'we'",
        "PROGRESSIVE_AMBIGUITY": "Progressive aspect (ati-)",
    }

    def aggregate(self, entry_results: list[dict]) -> dict:
        """Compute corpus-level linter aggregates."""
        from champollion_lyss.roles import envelope, fst_tool_versions

        total = len(entry_results)
        base = {
            # LYSS role envelope (primary discovery) + legacy flag (back-compat
            # for archived run cards / older harnesses) — see roles.py.
            **envelope("eq", tool_versions=fst_tool_versions("crk")),
            "is_equivalence_linter": True,
            "display_name": self.DISPLAY_NAME,
            "variant_labels": self.VARIANT_LABELS,
        }
        if total == 0:
            return {**base, "equivalent_match_rate": 0.0, "variant_class_counts": {}}

        equiv_count = sum(1 for r in entry_results if r.get("equivalent_match"))

        # Count variant class occurrences across all entries
        class_counts: dict[str, int] = {}
        for r in entry_results:
            for vc in r.get("variant_classes", []):
                class_counts[vc] = class_counts.get(vc, 0) + 1

        # Transparency: LEMMA_SYNONYM detection needs the FST. If it wasn't
        # available, say so rather than silently under-counting synonyms.
        synonym_detection_available = all(
            r.get("fst_available", False) for r in entry_results
        )

        return {
            **base,
            "equivalent_match_rate": equiv_count / total,
            "variant_class_counts": class_counts,
            "synonym_detection_available": synonym_detection_available,
        }


# ---------------------------------------------------------------------------
# CrkLintedChrF — chrF++ with documented-legitimate variation normalized away
# ---------------------------------------------------------------------------

def _load_sacrebleu_chrf():
    """Return a configured sacrebleu CHRF (chrF++) scorer, or None if absent."""
    try:
        from sacrebleu.metrics import CHRF

        return CHRF(word_order=2)
    except Exception:
        return None


class CrkLintedChrF:
    """LYSS-normalized chrF++: the linter's equivalence classes applied to chrF.

    Per entry:
        - lint verdict EXACT or EQUIVALENT → linted_chrf = 100.0. The pair
          differs only in cited-legitimate variant classes (orthographic
          convention, free word order, registered synonyms…), i.e. the
          hypothesis matches a member of the intensionally-defined reference
          set, so the similarity score is saturated by ruling.
        - MISS → linted_chrf = chrF++ (canonical sacrebleu, word_order=2)
          computed on convention-normalized strings (case/punctuation, macron
          → circumflex, preverb spacing) — residual error is scored without
          orthographic noise. Deeper normalizations (synonyms, particles) are
          deliberately NOT applied to MISS pairs in v1: they are only proven
          safe when the verifier converges.
        - raw_chrf (unnormalized chrF++ on the original strings) is reported
          alongside so the correction is always visible, and because
          linted_chrf is NOT comparable to published chrF++ numbers — it is
          a LYSS metric that uses chrF++ arithmetic, not chrF++.

    Fail-honest: without sacrebleu the metric reports unavailable.
    """

    name = "crk_linted_chrf"
    DISPLAY_NAME = "LYSS-normalized chrF++"

    def __init__(self):
        self._chrf = _load_sacrebleu_chrf()

    def compute(self, entry: dict) -> dict:
        from champollion_lyss.crk.linter import (
            _normalize_orthographic,
            lint_translation,
        )

        predicted = (entry.get("predicted") or "").strip()
        expected = (entry.get("expected") or "").strip()

        if self._chrf is None:
            return {
                "linted_chrf": None,
                "raw_chrf": None,
                "available": False,
                "reason": "sacrebleu not installed — run `mt-eval setup --lang crk`",
            }
        if not expected:
            return {"linted_chrf": None, "raw_chrf": None, "available": False,
                    "reason": "empty reference"}
        if not predicted:
            return {"linted_chrf": 0.0, "raw_chrf": 0.0, "available": True,
                    "lint_verdict": "NO_OUTPUT"}

        raw = self._chrf.sentence_score(predicted, [expected]).score
        result = lint_translation(expected, predicted)
        if result.exact_match or result.equivalent_match:
            linted = 100.0
        else:
            linted = self._chrf.sentence_score(
                _normalize_orthographic(predicted),
                [_normalize_orthographic(expected)],
            ).score

        return {
            "linted_chrf": linted,
            "raw_chrf": raw,
            "available": True,
            "lint_verdict": result.verdict,
        }

    def aggregate(self, entry_results: list[dict]) -> dict:
        from champollion_lyss.roles import envelope, fst_tool_versions

        base = envelope("chrf", tool_versions=fst_tool_versions("crk"))
        scored = [r for r in entry_results if r.get("available")]
        unavailable = len(entry_results) - len(scored)
        if not scored:
            return {**base, "available": False, "unavailable_count": unavailable,
                    "display_name": self.DISPLAY_NAME}
        n = len(scored)
        return {
            **base,
            "available": True,
            "display_name": self.DISPLAY_NAME,
            "linted_chrf_mean": sum(r["linted_chrf"] for r in scored) / n,
            "raw_chrf_mean": sum(r["raw_chrf"] for r in scored) / n,
            "scored_count": n,
            "unavailable_count": unavailable,
        }


# ---------------------------------------------------------------------------
# CrkSemanticMetric — Wraps semantic_validator.py's validate_entry()
# ---------------------------------------------------------------------------

class CrkSemanticMetric:
    """Deterministic semantic validator using FST lemma extraction +
    dictionary glosses (itwêwina API) + spaCy content-word overlap.

    Fails HONESTLY. When a prerequisite for a real judgment is missing — the FST
    isn't installed, the spaCy English model isn't installed, or gloss data can't
    be served (IP terms unacknowledged / itwêwina unavailable) and the verdict
    depended on it — the metric returns ``{"semantic_verdict": None,
    "available": False, "reason": ...}``. It NEVER fabricates a verdict or falls
    back to synthetic data (human-validated data only).

    Produces:
        Per-entry (available):   {"semantic_verdict": <VERDICT>, "available": True}
        Per-entry (unavailable): {"semantic_verdict": None, "available": False,
                                  "reason": <message + remedy>}
            VERDICT ∈ EXACT_MATCH | VALID | GRAMMAR_ISSUES | PARTIAL |
                      INCOMPLETE | WRONG | NO_OUTPUT
        Aggregate: semantic_verdict_counts (scored entries only),
                   scored_count, unavailable_count, available (bool)
    """

    name = "crk_semantic"

    # Validator verdicts that mean "could not judge" → reported as unavailable.
    _UNAVAILABLE_VERDICTS = {"FST_NO_ANALYSIS"}

    def __init__(self):
        self._generator = None
        self._gloss_map = None
        self._nlp = None
        self._nlp_reason: Optional[str] = None
        self._resources_ready = False

    def _init_resources(self):
        """Lazy-init heavy resources. Resilient: a spaCy load failure is captured
        (not raised) so compute() can report unavailable with a clear reason."""
        if self._resources_ready:
            return

        from champollion_lyss.crk.fst_adapter import FSTAnalyzer
        from champollion_lyss.crk.semantic_validator import (
            NLP_MODEL,
            load_gloss_map,
            load_nlp,
        )

        if self._generator is None:
            self._generator = FSTAnalyzer(lang_code="crk")
        if self._gloss_map is None:
            self._gloss_map = load_gloss_map()
        if self._nlp is None and self._nlp_reason is None:
            try:
                self._nlp = load_nlp()
            except Exception as e:  # spaCy or the model is missing
                self._nlp = None
                self._nlp_reason = (
                    f"spaCy model '{NLP_MODEL}' unavailable ({type(e).__name__}) — "
                    f"run `mt-eval setup --lang crk`"
                )
        self._resources_ready = True

    @staticmethod
    def _unavailable(reason: str) -> dict:
        return {"semantic_verdict": None, "available": False, "reason": reason}

    def compute(self, entry: dict) -> dict:
        """Run semantic validation on a single entry (fail honest)."""
        from champollion_lyss.crk.semantic_validator import validate_entry

        predicted = (entry.get("predicted") or "").strip()
        expected = (entry.get("expected") or "").strip()

        # Honest fast paths that need neither the FST nor the gloss API:
        if not predicted:
            return {"semantic_verdict": "NO_OUTPUT", "available": True}
        if predicted == expected:
            return {"semantic_verdict": "EXACT_MATCH", "available": True}

        self._init_resources()

        # Gate 1: the FST must be installed — otherwise we'd "judge" un-analyzed
        # text and (historically) emit a fabricated VALID. Refuse instead.
        if not self._generator.is_available():
            return self._unavailable(
                "FST for crk not installed — run `mt-eval setup --lang crk`"
            )

        # Gate 2: the spaCy English model must load for content-word overlap.
        if self._nlp is None:
            return self._unavailable(self._nlp_reason or "spaCy model unavailable")

        # Run the validator.
        try:
            validation = validate_entry(
                entry, self._generator, self._gloss_map, self._nlp
            )
        except Exception as e:
            logger.warning("Semantic validation failed: %s", e)
            return self._unavailable(f"semantic validation error: {e}")

        # Gate 3a: the FST produced no usable analysis for this entry.
        if validation.verdict in self._UNAVAILABLE_VERDICTS:
            return self._unavailable(
                "FST produced no analysis for this entry — verdict withheld"
            )

        # Gate 3b: the verdict used the gloss branch (differing lemmas), but
        # glosses couldn't be served — IP terms unacknowledged, or API down.
        if getattr(validation, "pair_verdicts", None) and getattr(
            self._gloss_map, "unavailable_reason", None
        ):
            return self._unavailable(
                f"gloss data unavailable — {self._gloss_map.unavailable_reason}; "
                f"verdict withheld"
            )

        return {"semantic_verdict": validation.verdict, "available": True}

    def aggregate(self, entry_results: list[dict]) -> dict:
        """Count verdicts across SCORED entries; report unavailable separately.

        Unavailable/None entries are excluded from ``semantic_verdict_counts`` so
        they can never inflate a pass rate. ``available`` is False when nothing
        was actually scored — the harness then sees the metric didn't run rather
        than a fabricated all-VALID result.
        """
        from champollion_lyss.roles import envelope, fst_tool_versions, spacy_tool_versions

        counts: dict[str, int] = {}
        unavailable = 0
        for r in entry_results:
            if r.get("available") is False or r.get("semantic_verdict") is None:
                unavailable += 1
                continue
            verdict = r.get("semantic_verdict", "UNKNOWN")
            counts[verdict] = counts.get(verdict, 0) + 1
        scored = sum(counts.values())
        try:
            from champollion_lyss.crk.semantic_validator import NLP_MODEL as _nlp_model
        except Exception:  # semantic_validator's deps are optional
            _nlp_model = None
        tool_versions = {
            **fst_tool_versions("crk"),
            **spacy_tool_versions(_nlp_model),
        }
        return {
            **envelope("sem", tool_versions=tool_versions),
            "semantic_verdict_counts": counts,
            "scored_count": scored,
            "unavailable_count": unavailable,
            "available": scored > 0,
        }
