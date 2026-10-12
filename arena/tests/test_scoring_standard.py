"""The scoring standard ("standard/1", founder 2026-10-04: "we want scoring to
be industry standard").

What it fixes, measured (synthetic researcher, eng→sme): an untrained model
that printed ONE valid Northern Sami sentence for every input scored a
weighted composite of 0.6244, labelled 'functional', with chrF++ 5.5 —
because the repeated words are valid Sami and FST acceptance carried the
composite. A toy glossary that dropped every word it could not translate
scored 0.6612. No standard evaluation ranks those systems above a real
translation.

The standard (WMT / FLORES-200 / AmericasNLP practice): the headline and
ranking metric is corpus chrF++ with its sacreBLEU signature and a 95%
bootstrap CI; BLEU / spBLEU / TER / COMET are shown beside it, never
blended; diagnostics and caveats are reported separately; no quality tiers.

These tests pin:
  * on the headline, the constant-valid-sentence toy and the word-dropping
    glossary rank BELOW a real translation, with non-overlapping CIs, while
    their caveats still show;
  * the retired composite would have ranked the toy above the real
    translation (why it was retired — kept as the legacy record);
  * a new run card carries scoring_standard / primary_metric and a NULL
    composite / quality_tier / cost_adjusted, in the card and in the DB row;
  * no new output prints a composite or a tier;
  * a legacy card (no scoring_standard) is still verified by re-deriving its
    stored composite; a standard/1 card claiming one is not.
"""

from __future__ import annotations

import contextlib
import io
import json

import pytest

from mt_eval_harness import publish, scoring
from mt_eval_harness.tester import analyze_run_log


# A small eng→sme-like set: 30 DISTINCT references (synthetic, built here).
_WORDS = ["Mun", "leat", "boahtán", "dál", "ruoktot", "son", "lea", "buorre",
          "olmmoš", "mii", "bargat", "odne", "skuvllas", "giella", "ođđa",
          "girji", "lohkat", "eahkes", "beaivi", "čáhci"]


def _references(n: int = 30) -> list[str]:
    refs = []
    for i in range(n):
        k = 4 + (i % 4)
        words = [_WORDS[(i * 3 + j * 7) % len(_WORDS)] for j in range(k)]
        refs.append(" ".join(words) + f" {i}.")
    return refs


REFS = _references()
SOURCES = [f"English sentence number {i} about everyday life." for i in range(len(REFS))]

#: A real (imperfect) translation: the reference with one word misspelt.
REAL = [r.replace(r.split()[1], r.split()[1][:-1] + "a", 1) for r in REFS]
#: The constant-valid-sentence toy: one valid sentence for every input.
CONSTANT = ["Mun lean boahtán ruoktot dál."] * len(REFS)
#: The word-dropping glossary: only the words it knows, the rest dropped.
_KNOWN = {"Mun", "leat", "son", "lea"}
GLOSSARY = [" ".join(w for w in r.split() if w in _KNOWN) or "Mun" for r in REFS]


def _run_log(name: str, outputs: list[str]) -> dict:
    return {
        "run_id": name, "harness_version": "0.2.0",
        "timestamp_start": "2026-10-04T00:00:00Z", "elapsed_s": 1.0,
        "total_cost_usd": None, "cache_hits": 0,
        "config": {"model": name, "prompt_version": "naive",
                   "temperature": 0.0, "batch_size": 1, "max_tokens": 64,
                   "dataset_id": "standard-test", "source_lang": "English",
                   "target_lang": "Northern Sami", "provider": "local"},
        "provenance": {"corpus_sha256": "c" * 64,
                       "endpoint_locality": "loopback"},
        "results": [{"id": f"e{i}", "source": s, "expected": r,
                     "predicted": o, "raw_predicted": o, "latency_s": 0.1,
                     "cost_usd": None, "cached": False, "error": None}
                    for i, (s, r, o) in enumerate(zip(SOURCES, REFS, outputs))],
    }


def _quiet(fn, *a, **kw):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        out = fn(*a, **kw)
    return out, buf.getvalue()


@pytest.fixture(autouse=True)
def _no_git(monkeypatch):
    monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)
    monkeypatch.setattr(publish, "_is_prod_target", lambda: False)


@pytest.fixture(scope="module")
def reports():
    out = {}
    for name, outputs in (("real", REAL), ("constant", CONSTANT),
                          ("glossary", GLOSSARY)):
        rep, text = _quiet(analyze_run_log, _run_log(name, outputs),
                           compute_ci=True, n_bootstrap_ci=300)
        out[name] = (rep, text)
    return out


def _headline(report):
    ov = report["overall"]
    ci = ov["confidence_intervals"]["corpus_chrf"]
    return ov["corpus_chrf"], ci["ci_lower"], ci["ci_upper"]


class TestTheToysRankLow:

    def test_constant_sentence_ranks_below_a_real_translation(self, reports):
        real, real_lo, _ = _headline(reports["real"][0])
        toy, _, toy_hi = _headline(reports["constant"][0])
        assert real > toy
        # Not a close call: the CIs do not overlap.
        assert toy_hi < real_lo
        assert toy < 30

    def test_word_dropping_glossary_ranks_below_a_real_translation(self, reports):
        real, real_lo, _ = _headline(reports["real"][0])
        gl, _, gl_hi = _headline(reports["glossary"][0])
        assert real > gl
        assert gl_hi < real_lo

    def test_their_caveats_still_show(self, reports):
        kinds = {c["kind"] for c in reports["constant"][0].get("score_caveats", [])}
        assert "near_constant_output" in kinds
        gl_kinds = {c["kind"] for c in reports["glossary"][0].get("score_caveats", [])}
        assert "length_deflation" in gl_kinds
        # Printed under the headline, before any diagnostic.
        text = reports["constant"][1]
        assert text.index("Headline:") < text.index("SCORE CAVEAT") < text.index("Diagnostics")

    def test_the_retired_composite_would_have_ranked_the_toy_first(self):
        # The legacy record of why it was retired: with FST acceptance 100%
        # (every repeated word valid Sami) and chrF++ 5.5, the acceptor-only
        # FST profile put the toy above a real translation's chrF++ 45 / FST
        # 70%. Kept only to verify old cards.
        toy = scoring.compute_composite_score(
            {"chrf_plus_plus": 5.5, "fst_acceptance_rate": 1.0,
             "exact_match_rate": 0.0, "code_switching_rate": 0.0,
             "hallucination_rate": 0.0}, profile="fst-coverage")
        real = scoring.compute_composite_score(
            {"chrf_plus_plus": 45.0, "fst_acceptance_rate": 0.7,
             "exact_match_rate": 0.1, "code_switching_rate": 0.0,
             "hallucination_rate": 0.0}, profile="fst-coverage")
        assert toy > real
        assert scoring.classify_quality_tier(toy) in ("functional", "deployable")


class TestReportAndSummary:

    def test_report_records_the_standard_and_no_composite(self, reports):
        ov = reports["real"][0]["overall"]
        assert ov["scoring_standard"] == scoring.SCORING_STANDARD == "standard/1"
        assert ov["primary_metric"] == scoring.PRIMARY_METRIC == "chrf_plus_plus"
        assert "published_composite" not in ov
        assert ov["sacrebleu_signatures"]["chrf"]

    def test_summary_prints_the_headline_and_no_composite_or_tier(self, reports):
        text = reports["real"][1]
        chrf, lo, hi = _headline(reports["real"][0])
        assert f"chrF++ {chrf:.1f} [{lo:.1f}, {hi:.1f}]" in text
        assert "Signature:" in text and "nrefs:1" in text
        lowered = text.lower()
        assert "composite" not in lowered
        for tier in ("quality tier", "functional", "deployable", "fluent",
                     "emerging"):
            assert tier not in lowered


class TestRunCardContract:

    @pytest.fixture()
    def card(self, tmp_path):
        log = _run_log("constant", CONSTANT)
        log_path = tmp_path / "constant.json"
        log_path.write_text(json.dumps(log), encoding="utf-8")
        rep_path = tmp_path / "constant_report.json"
        _quiet(analyze_run_log, log, output_path=rep_path,
               source_log_path=str(log_path), compute_ci=True,
               n_bootstrap_ci=200)
        (card, card_id, fp), _ = _quiet(publish.assemble_run_card, rep_path)
        return card, card_id, fp

    def test_scores_carry_the_standard(self, card):
        scores = card[0]["scores"]
        assert scores["scoring_standard"] == "standard/1"
        assert scores["primary_metric"] == "chrf_plus_plus"
        assert scores["composite"] is None
        assert scores["quality_tier"] is None
        assert scores["cost_adjusted"] is None
        assert scores["chrf_plus_plus"] is not None
        assert "corpus_chrf" in scores["confidence_intervals"]
        assert "composite_score" not in scores["confidence_intervals"]
        assert "segment_composite" not in scores["confidence_intervals"]
        assert "scoring_profile" not in scores
        assert card[0]["method_config"]["qualityTier"] is None
        # The caveat rides the card for the leaderboard to show.
        assert any(c["kind"] == "near_constant_output"
                   for c in card[0]["score_caveats"])

    def test_db_row_has_null_composite_and_tier_and_chrf_ci(self, card):
        rc, card_id, fp = card
        row = publish.build_run_card_row(rc, card_id, fp, submitter="t@x")
        assert row["composite_score"] is None
        assert row["quality_tier"] is None
        assert row["composite_ci_lower"] is None
        assert row["composite_ci_upper"] is None
        assert row["chrf_plus_plus"] == rc["scores"]["chrf_plus_plus"]
        assert row["chrf_ci_lower"] is not None
        assert row["chrf_ci_upper"] is not None

    def test_headline_helper_reads_the_card(self, card):
        h = scoring.headline_from_card(card[0])
        assert h["scoring_standard"] == "standard/1"
        assert h["text"].startswith("chrF++ ")
        assert "[" in h["text"]
        assert h["signature"]
        assert h["legacy_composite"] is None


class TestFormatting:

    def test_format_primary(self):
        assert scoring.format_primary(47.5, 45.9, 49.0) == "chrF++ 47.5 [45.9, 49.0]"
        assert scoring.format_primary(47.5) == "chrF++ 47.5"
        assert scoring.format_primary(None) == "chrF++ —"

    def test_format_secondary_never_blends(self):
        text = scoring.format_secondary(
            {"corpus_bleu": 21.34, "ter": 61.2, "comet_score": 0.7123,
             "spbleu": None})
        assert text == "BLEU 21.3 · TER 61.2 · COMET 0.712"

    def test_legacy_card_is_labelled(self):
        h = scoring.headline_from_card(
            {"scores": {"chrf_plus_plus": 5.5, "composite": 0.6244,
                        "quality_tier": "functional"}})
        assert h["scoring_standard"] == scoring.LEGACY_SCORING
        assert h["legacy_composite"] == 0.6244
        assert scoring.LEGACY_COMPOSITE_LABEL == "legacy composite (retired)"


class TestVerifier:

    def _legacy(self, composite, **scores):
        base = {"chrf_plus_plus": 45.0, "exact_match_rate": 0.1,
                "fst_acceptance_rate": None, "scoring_profile": "surface-only"}
        base.update(scores)
        return {"composite_score": composite, "run_card": {"scores": base}}

    def test_legacy_card_composite_re_derives(self):
        from mt_eval_harness.verifier import (
            card_scoring_standard, legacy_composite_check)
        expected = scoring.compute_composite_score(
            {"chrf_plus_plus": 45.0, "exact_match_rate": 0.1},
            profile="surface-only")
        card = self._legacy(expected)
        assert card_scoring_standard(card) == "legacy-composite"
        ok, reason, recomputed = legacy_composite_check(card)
        assert ok, reason
        assert recomputed == expected

    def test_legacy_card_with_a_hand_edited_composite_fails(self):
        from mt_eval_harness.verifier import legacy_composite_check
        ok, reason, _ = legacy_composite_check(self._legacy(0.9))
        assert not ok and "MISMATCH" in reason

    def test_legacy_card_from_before_profiles_uses_the_has_fst_rule(self):
        from mt_eval_harness.verifier import legacy_composite_check
        inputs = {"chrf_plus_plus": 5.5, "fst_acceptance_rate": 1.0,
                  "exact_match_rate": 0.0}
        stored = scoring.compute_composite_score(inputs, profile="fst-coverage")
        card = {"composite_score": stored, "run_card": {"scores": dict(inputs)}}
        ok, reason, _ = legacy_composite_check(card)
        assert ok, reason

    def test_standard_card_must_not_claim_a_composite_or_tier(self):
        from mt_eval_harness.verifier import (
            card_scoring_standard, standard_card_check)
        clean = {"composite_score": None, "quality_tier": None,
                 "run_card": {"scores": {"scoring_standard": "standard/1"}}}
        assert card_scoring_standard(clean) == "standard/1"
        assert standard_card_check(clean)[0]
        bad = dict(clean, composite_score=0.62)
        assert not standard_card_check(bad)[0]
        bad_tier = dict(clean, quality_tier="functional")
        assert not standard_card_check(bad_tier)[0]
