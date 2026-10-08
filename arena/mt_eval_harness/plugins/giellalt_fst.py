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


#: How FST acceptance is computed from the transducer's answers — named in
#: every aggregate (``fst_acceptance_method``) and in the run card's
#: ``fst_provenance`` so a score computed one way is never compared with one
#: computed another way unawares. A report without the key was computed
#: case-sensitively (before Round 13): a word was looked up exactly as
#: written, so a correct sentence-initial capital ("Mun") failed where the
#: same word in lower case ("mun") passed.
#:
#: ``case-fallback/1``: a word is looked up as written; if rejected and it
#: starts with a capital, with its first letter lowered ("Mun" -> "mun");
#: if it is ALL CAPS, as Titlecase ("OSLO" -> "Oslo") and then fully lowered
#: ("GIITU" -> "giitu"). Never upward: "oslo" is not retried as "Oslo" — a
#: lower-case proper noun stays a misspelling. This is what GiellaLT's own
#: speller engine does around its case-sensitive acceptors (divvunspell's
#: case handling), and what its descriptive analysers do for initial
#: capitals; the bare acceptors (speller-sme) and ALTLab's strict crk
#: analyser do none of it themselves.
FST_ACCEPTANCE_METHOD = "case-fallback/1"

#: The computation before ``case-fallback/1``: every word looked up exactly as
#: written. Kept so the verifier can reproduce a card published before Round
#: 13 the way it was computed (``GiellaLTFSTMetric(case_fallback=False)``).
FST_ACCEPTANCE_METHOD_CASE_SENSITIVE = "case-sensitive/0"

#: Every acceptance method this plugin can reproduce, by name.
FST_ACCEPTANCE_METHODS = (FST_ACCEPTANCE_METHOD,
                          FST_ACCEPTANCE_METHOD_CASE_SENSITIVE)


def case_variants(word: str) -> list[str]:
    """The forms of ``word`` to look up, in order, for ``case-fallback/1``.

    The word as written first; then, only for a word that STARTS with an
    upper-case letter, the lowered forms its capitals may stand for:
    Titlecase -> first letter lowered; ALL CAPS -> Titlecase, then all
    lower. Mixed case that does not start with a capital ("eLLe") and
    lower-case words get no variant. Duplicates are dropped."""
    out = [word]
    if not word or not word[0].isupper():
        return out
    cased = [ch for ch in word if ch.isalpha() and (ch.isupper() or ch.islower())]
    all_caps = len(cased) > 1 and all(ch.isupper() for ch in cased)
    if all_caps:
        candidates = [word[0] + word[1:].lower(), word.lower()]
    else:
        candidates = [word[0].lower() + word[1:]]
    for c in candidates:
        if c not in out:
            out.append(c)
    return out


# Coverage floor for morphological_accuracy. Below this fraction of analyzable
# predicted words being lemma-matched to the reference, the metric is too sparse
# to be meaningful — publish.py reports morph_coverage but leaves
# morphological_accuracy out of the composite (None) rather than score a
# misleading number. (Disclosed, never silently filled.)
MORPH_COVERAGE_FLOOR = 0.25


def corpus_rates(entry_results: list[dict]) -> dict:
    """The corpus-level RATES of this metric, from its per-entry results alone.

    A pure function of what ``compute()`` returned, so it can be re-run on any
    subset of entries — ``aggregate()`` uses it for the headline, and paired
    significance (significance.run_significance_tests) re-runs it on every
    resample. The per-entry keys (``fst_validity_rate``, ``fst_valid_words``…)
    are NOT the aggregate keys (``avg_fst_validity``…), so a test that looks
    the aggregate key up per entry finds nothing and reports 0.00 vs 0.00,
    p=1.000 for every run (synthetic researcher, sme, 4.4% vs 29.7%,
    2026-10-03). Counts are not returned: they are not rates to compare.

    Returns {} when no entry was analyzed (the FST-unavailable case). An
    entry that was never analyzed carries an empty result ({}) rather than an
    ``error``, since a missing FST stopped being fatal; counting it as
    analyzed crashed ``compare --significance`` on every fresh install
    (synthetic school, crk, 2026-10-04).
    ``morphological_accuracy`` / ``morph_coverage`` are None when the
    transducer gave no tagged analysis at all (an acceptor, see
    ``aggregate``) or, for accuracy, when no word was covered.
    """
    valid = [r for r in entry_results
             if isinstance(r, dict) and "error" not in r and "fst_validity_rate" in r]
    if not valid:
        return {}
    rates = [r["fst_validity_rate"] for r in valid]
    total_words = sum(r["fst_total_words"] for r in valid)
    total_valid = sum(r["fst_valid_words"] for r in valid)
    m_analyzable = sum(r.get("morph_analyzable_words", 0) for r in valid)
    m_covered = sum(r.get("morph_covered_words", 0) for r in valid)
    m_correct = sum(r.get("morph_correct_words", 0) for r in valid)
    acceptor = _yields_no_tags(valid)
    morph_accuracy = (m_correct / m_covered) if (m_covered > 0 and not acceptor) else None
    if acceptor:
        morph_coverage = None
    else:
        morph_coverage = (m_covered / m_analyzable) if m_analyzable > 0 else 0.0
    return {
        "avg_fst_validity": sum(rates) / len(rates),
        "corpus_validity_rate": total_valid / max(total_words, 1),
        "morphological_accuracy": (
            round(morph_accuracy, 4) if morph_accuracy is not None else None
        ),
        "morph_coverage": (
            round(morph_coverage, 4) if morph_coverage is not None else None
        ),
    }


def _yields_no_tags(valid_results: list[dict]) -> bool:
    """True when words were analyzed but no analysis carried a single tag.

    That is an ACCEPTOR (a speller's yes/no transducer), not an analyzer: it
    echoes the word back as its own "lemma" with no inflection, so lemma
    matching collapses into word overlap and every covered word scores
    "correct" (synthetic researcher, `mt-eval setup --lang sme`, 2026-10-03).
    Results computed before ``morph_tagged_words`` existed carry no count and
    are not judged.
    """
    if not any("morph_tagged_words" in r for r in valid_results):
        return False
    analyzable = sum(r.get("morph_analyzable_words", 0) for r in valid_results)
    tagged = sum(r.get("morph_tagged_words", 0) for r in valid_results)
    return analyzable > 0 and tagged == 0


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

    def __init__(self, lang_code: str, fst_dir: Path, *,
                 case_fallback: bool = True):
        """Initialize with a language code and FST directory.

        Args:
            lang_code: ISO 639-3 code (e.g. "crk", "sme")
            fst_dir: Path to directory containing .hfstol files
            case_fallback: ``case-fallback/1`` (the default). False reproduces
                the case-sensitive computation of a score made before it —
                only the verifier re-deriving an old card asks for that.
        """
        self.lang_code = lang_code
        self._fst_dir = fst_dir
        self._analyzer = None
        self.case_fallback = bool(case_fallback)
        self.acceptance_method = (FST_ACCEPTANCE_METHOD if self.case_fallback
                                  else FST_ACCEPTANCE_METHOD_CASE_SENSITIVE)

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
                "Install it with: mt-eval setup --fst (or: python3 -m pip "
                "install pyhfst)"
            )

        input_stream = pyhfst.HfstInputStream(str(analyzer_path))
        self._analyzer = input_stream.read()
        logger.info("Loaded FST analyzer: %s", analyzer_path.name)
        return self._analyzer

    def _lookup(self, form: str) -> list:
        """The transducer's analyses of one exact form ([] on a lookup error)."""
        analyzer = self._load_analyzer()
        try:
            return analyzer.lookup(form) or []
        except Exception as e:
            logger.warning("FST lookup error for word %r: %s", form, e)
            return []

    def _accepting_form(self, word: str) -> tuple[Optional[str], list]:
        """The first of :func:`case_variants` the transducer accepts, with its
        analyses — ``(None, [])`` when it accepts none of them."""
        for form in (case_variants(word) if self.case_fallback else [word]):
            results = self._lookup(form)
            if results:
                return form, results
        return None, []

    def _analyze_word(self, word: str) -> bool:
        """Check if a word is recognized by the FST analyzer.

        Returns True if the FST returns at least one analysis for the word as
        written or for one of its lowered case variants (:func:`case_variants`).
        """
        return self._accepting_form(word)[0] is not None

    def _word_analyses(self, word: str) -> list[tuple[str, frozenset[str]]]:
        """FST-analyze a word → list of (lemma, tagset) candidates.

        Empty list if the word is pure punctuation or the FST returns no
        analysis (not analyzable). Used for morphological_accuracy. The same
        case fallback as acceptance (:func:`case_variants`), so a
        sentence-initial capital is analysed — in the prediction and in the
        reference alike.
        """
        clean = word.strip(".,;:!?\"'()[]{}—–-")
        if not clean:
            return []
        _form, results = self._accepting_form(clean)
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
            # "acceptor" when the pin declares one (fst-pins.json install.kind),
            # else None — an analyzer is the default a pin need not state.
            "fst_kind": None,
            "analyzer_file": None,
            "pyhfst_version": None,
            # How acceptance is computed from the transducer's answers — rides
            # into the run card's fst_provenance with the release it ran on.
            "acceptance_method": self.acceptance_method,
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
                info["fst_kind"] = prov.get("kind") or None
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
        # Words accepted only in a lowered case form, with the form accepted
        # ({"word": "Mun", "accepted_as": "mun"}) — case-fallback/1.
        case_folded = []

        for word in words:
            # Strip punctuation from word edges before analysis.
            # FSTs expect clean word forms without trailing periods, commas, etc.
            clean = word.strip(".,;:!?\"'()[]{}—–-")
            if not clean:
                # Pure punctuation — skip (don't count as invalid)
                total -= 1
                continue

            form, _results = self._accepting_form(clean)
            if form is None:
                invalid_words.append(clean)
                continue
            valid += 1
            if form != clean:
                case_folded.append({"word": clean, "accepted_as": form})

        result = {
            "fst_total_words": total,
            "fst_valid_words": valid,
            "fst_validity_rate": valid / max(total, 1),
            "fst_invalid_words": invalid_words,
            "fst_case_folded_words": case_folded,
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
        morph_tagged = 0
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
                # Counted so aggregate() can tell an analyzer from an acceptor
                # (which never returns a tag) — see _yields_no_tags.
                if any(tags for _lemma, tags in cands):
                    morph_tagged += 1
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
        result["morph_tagged_words"] = morph_tagged
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

        # Macro/micro FST validity and the lemma-matched morph rates — one
        # definition (corpus_rates), shared with paired significance testing.
        rates = corpus_rates(valid_results)
        version_info = self.version_info()

        out = {
            "avg_fst_validity": rates["avg_fst_validity"],
            # How acceptance was computed (FST_ACCEPTANCE_METHOD) — absent on a
            # report computed before Round 13 (case-sensitive lookups).
            "fst_acceptance_method": self.acceptance_method,
            # Words accepted only in a lowered case form (sentence-initial
            # capitals, ALL CAPS) — counted so the effect of the fallback is
            # visible, never silent.
            "total_case_folded_words": sum(
                len(r.get("fst_case_folded_words") or []) for r in valid_results),
            # FST release + pyhfst version (sacrebleu_signatures precedent) — carried
            # into the run card by publish.py as fst_version / fst_provenance.
            "fst_version_info": version_info,
            "total_words_checked": sum(r["fst_total_words"] for r in valid_results),
            "total_valid_words": sum(r["fst_valid_words"] for r in valid_results),
            "corpus_validity_rate": rates["corpus_validity_rate"],
            # Morphological accuracy (FST-derived, lemma-matched). None when no
            # words were covered. morph_coverage = fraction of analyzable predicted
            # words lemma-matched to the reference; publish.py applies
            # MORPH_COVERAGE_FLOOR and reports coverage transparently (never fills
            # a misleading number below the floor).
            "morphological_accuracy": rates["morphological_accuracy"],
            "morph_coverage": rates["morph_coverage"],
            "morph_covered_words": sum(
                r.get("morph_covered_words", 0) for r in valid_results),
            "morph_analyzable_words": sum(
                r.get("morph_analyzable_words", 0) for r in valid_results),
        }

        # An ACCEPTOR (a speller's yes/no transducer — the Divvun packages
        # installed for sme/amh/eus) gives no lemma and no tags. FST acceptance
        # still means something (it accepts or rejects each word), but
        # "morphological accuracy" over it is word overlap published under the
        # wrong name. Declared on the pin (install.kind = "acceptor", recorded
        # into provenance.json) or detected (no analysis carried a tag), the
        # morph rates become None with the reason stated — the composite then
        # re-normalizes over what was measured (scoring.compute_composite_score).
        reason = None
        if version_info.get("fst_kind") == "acceptor":
            reason = ("the installed transducer is a spell-checker acceptor "
                      "(its pin declares kind 'acceptor'): it accepts or rejects "
                      "words but returns no lemma or tags, so morphological "
                      "accuracy cannot be measured with it")
        elif _yields_no_tags(valid_results):
            reason = ("the installed transducer returned no tagged analysis for "
                      "any word — it behaves as an acceptor (no lemma or tags), "
                      "so morphological accuracy cannot be measured with it")
        if reason:
            out["morphological_accuracy"] = None
            out["morph_coverage"] = None
            out["morph_unavailable_reason"] = reason
        return out
