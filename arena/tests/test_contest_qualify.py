"""contest_qualify — the public admission gate and its receipt (C1).

The scoring is REAL: the synthetic qaa>qab dev fixture is scored by the one
scorer (external_scoring.score_hypotheses → sacrebleu → assemble_run_card), so
a perfect hypotheses file clears the gate and a garbage one does not, for the
reason the gate itself gives. Only the contest/qualifier fetch crosses the
network, and that is monkeypatched.

What these pin:
  * the receipt's exact shape and its honesty fields (selfReported, the note
    that the node's re-execution is what gates);
  * a FAILING attempt still writes the receipt (passed=false) and then raises
    — the attempt is a fact, not something to hide;
  * the dev file must BE the qualifier corpus (a right score against the wrong
    file is impossible);
  * require_pass refuses in every direction: failed, wrong contest, wrong
    qualifier, a bar that has since moved up.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness import contest_qualify
from mt_eval_harness.contest_qualify import (
    QualifierError,
    load_receipt,
    qualify,
    receipt_path,
    require_pass,
)

FIXTURES = Path(__file__).parent / "fixtures" / "contest_synthetic"
DEV_CORPUS = FIXTURES / "corpus_dev.json"

CONTEST_ID = "synth-open-2026"
QUALIFIER_ID = "eval-qaa-qab-synth-qualifier-v2026"
QUALIFIER_CORPUS = "eval-qaa-qab-synth-dev-v1"
THRESHOLD = 50.0


def _dev_refs() -> list[str]:
    data = json.loads(DEV_CORPUS.read_text(encoding="utf-8"))
    return [e["reference"] for e in data["entries"]]


def _wire(monkeypatch, *, threshold: float = THRESHOLD,
          qualifier_id: str = QUALIFIER_ID,
          corpus_card_id: str = QUALIFIER_CORPUS,
          metric: str = "chrf_plus_plus"):
    monkeypatch.setattr(
        contest_qualify, "_resolve_qualifier",
        lambda cid, offline: {
            "contest": {"id": cid, "language_pair": "qaa>qab"},
            "qualifier": {"qualifier_id": qualifier_id,
                          "corpus_card_id": corpus_card_id,
                          "threshold": threshold, "metric": metric,
                          "year": 2026},
            "offline": False,
        })


def _hyps(tmp_path, lines) -> Path:
    p = tmp_path / "dev-hyps.txt"
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return p


def _kwargs(tmp_path, lines):
    return dict(dev_hyp_path=_hyps(tmp_path, lines),
                dev_corpus_path=DEV_CORPUS,
                system_label="acme-nmt",
                method_class="pipeline",
                receipt_dir=tmp_path / "receipts")


class TestQualifyWritesTheReceipt:
    def test_perfect_dev_file_passes_and_writes_the_receipt(self, tmp_path,
                                                            monkeypatch):
        _wire(monkeypatch)
        receipt = qualify(CONTEST_ID, **_kwargs(tmp_path, _dev_refs()))

        assert receipt["receiptVersion"] == "1.0.0"
        assert receipt["contestId"] == CONTEST_ID
        assert receipt["qualifierId"] == QUALIFIER_ID
        assert receipt["metric"] == "chrf_plus_plus"
        assert receipt["threshold"] == THRESHOLD
        assert receipt["passed"] is True
        assert receipt["score"] >= THRESHOLD
        assert receipt["selfReported"] is True
        assert len(receipt["devCorpusSha256"]) == 64
        assert len(receipt["hypothesesSha256"]) == 64
        assert receipt["harnessVersion"]
        assert receipt["scoredAt"]
        # The honesty note: this is not a verdict.
        assert "organizer node re-executes" in receipt["note"]

        on_disk = json.loads(
            receipt_path(CONTEST_ID, tmp_path / "receipts",
                         system="acme-nmt").read_text(encoding="utf-8"))
        assert on_disk == receipt
        assert receipt["system"] == "acme-nmt"
        assert receipt["methodClass"] == "pipeline"

    def test_receipt_lands_at_the_documented_path(self, tmp_path, monkeypatch):
        _wire(monkeypatch)
        qualify(CONTEST_ID, **_kwargs(tmp_path, _dev_refs()))
        # <receipt-dir>/<contest-id>/<system-slug>-<8 hex>.json
        (path,) = (tmp_path / "receipts" / CONTEST_ID).glob("acme-nmt-*.json")
        assert len(path.stem.rsplit("-", 1)[1]) == 8

    def test_failing_score_writes_a_passed_false_receipt_then_raises(
            self, tmp_path, monkeypatch):
        _wire(monkeypatch)
        with pytest.raises(QualifierError, match="Qualifier NOT met"):
            qualify(CONTEST_ID, **_kwargs(tmp_path, ["zzz"] * 6))
        receipt = load_receipt(CONTEST_ID, tmp_path / "receipts",
                               system="acme-nmt")
        assert receipt["passed"] is False
        assert receipt["score"] < THRESHOLD

    def test_prints_pass_and_the_threshold_it_cleared(self, tmp_path,
                                                      monkeypatch, capsys):
        _wire(monkeypatch)
        qualify(CONTEST_ID, **_kwargs(tmp_path, _dev_refs()))
        out = capsys.readouterr().out
        assert "PASS" in out
        assert str(THRESHOLD) in out
        assert QUALIFIER_ID in out


def _sacrebleu_chrf_pp(hyps: list[str]) -> float:
    """Corpus chrF++ straight from sacreBLEU (chrF, word_order=2)."""
    from sacrebleu.metrics import CHRF
    return CHRF(word_order=2).corpus_score(hyps, [_dev_refs()]).score


class TestTheQualifierIsChrfPlusPlus:
    """Scoring standard/1: the qualifier score IS corpus chrF++ (0-100)."""

    def test_the_score_equals_corpus_chrf_plus_plus(self, tmp_path,
                                                    monkeypatch):
        _wire(monkeypatch, threshold=10.0)
        hyps = ["sol mirava", "luna kanivo", "pira venu", "keno toluvo",
                "rena silo", "meno haruvo"]
        receipt = qualify(CONTEST_ID, **_kwargs(tmp_path, hyps))
        assert receipt["metric"] == "chrf_plus_plus"
        assert receipt["score"] == pytest.approx(
            round(_sacrebleu_chrf_pp(hyps), 2), abs=0.01)
        basis = receipt["scoreBasis"]
        assert basis["scale"].startswith("chrF++ 0-100")
        assert basis["scoringStandard"] == "standard/1"
        assert "nw:2" in (basis["signature"] or "")
        # Exact match is a diagnostic, recorded apart — never in the score.
        assert "exact_match_rate" in basis["diagnostics"]
        assert "composite" not in json.dumps(receipt)
        assert "quality_tier" not in json.dumps(receipt)

    def test_an_untrained_constant_sentence_does_not_clear_a_real_bar(
            self, tmp_path, monkeypatch):
        # The measured failure the standard retires: an untrained model that
        # repeats ONE valid sentence for every input scored composite 0.6244
        # ('functional') at chrF++ 5.5. On chrF++ it sits far below a
        # realistic bar that a real (imperfect) translation clears.
        bar = 35.0
        _wire(monkeypatch, threshold=bar)
        constant = ["sol miravo"] * 6
        with pytest.raises(QualifierError, match="Qualifier NOT met"):
            qualify(CONTEST_ID, **_kwargs(tmp_path, constant))
        low = load_receipt(CONTEST_ID, tmp_path / "receipts",
                           system="acme-nmt")
        assert low["passed"] is False and low["score"] < bar

        real = ["sol mirava", "luna kanivo", "pira venu", "keno toluvo",
                "rena silo", "meno haruvo"]
        (tmp_path / "real").mkdir()
        ok = qualify(CONTEST_ID, **{**_kwargs(tmp_path / "real", real),
                                    "system_label": "real-nmt"})
        assert ok["passed"] is True and ok["score"] >= bar
        assert ok["score"] > low["score"] + 30

    def test_prints_the_chrf_scale_never_a_composite(self, tmp_path,
                                                     monkeypatch, capsys):
        _wire(monkeypatch)
        qualify(CONTEST_ID, **_kwargs(tmp_path, _dev_refs()))
        out = capsys.readouterr().out
        assert "chrF++ 0-100 qualifier" in out
        assert "composite" not in out.replace("composite is retired", "")

    def test_a_legacy_composite_qualifier_gates_on_chrf_and_says_so(
            self, tmp_path, monkeypatch, capsys):
        # A qualifiers row registered before the standard names 'composite'
        # (migration 042's column default). It is gated on chrF++, its
        # threshold read on the chrF++ scale, and that is printed and
        # recorded in the receipt.
        _wire(monkeypatch, metric="composite")
        receipt = qualify(CONTEST_ID, **_kwargs(tmp_path, _dev_refs()))
        assert receipt["metric"] == "chrf_plus_plus"
        assert receipt["thresholdMetricAsRecorded"] == "composite"
        assert "chrF++ 0-100" in receipt["thresholdNote"]
        out = capsys.readouterr().out
        assert "composite is retired" in out

    def test_a_qualifier_naming_another_metric_is_refused(self, tmp_path,
                                                          monkeypatch):
        _wire(monkeypatch, metric="bleu")
        with pytest.raises(QualifierError, match="chrF\\+\\+ only"):
            qualify(CONTEST_ID, **_kwargs(tmp_path, _dev_refs()))

    def test_a_receipt_minted_on_the_composite_is_refused_by_require_pass(
            self):
        with pytest.raises(QualifierError, match="retired the qualifier"):
            require_pass(_receipt(metric="composite"), contest_id=CONTEST_ID,
                         qualifier_id=QUALIFIER_ID, threshold=THRESHOLD)


class TestQualifyRefusals:
    def test_wrong_dev_corpus_is_refused_before_scoring(self, tmp_path,
                                                        monkeypatch):
        _wire(monkeypatch, corpus_card_id="eval-some-other-dev-v1")
        with pytest.raises(QualifierError, match="identifies as"):
            qualify(CONTEST_ID, **_kwargs(tmp_path, _dev_refs()))

    def test_missing_hypotheses_file_is_refused(self, tmp_path, monkeypatch):
        _wire(monkeypatch)
        kwargs = _kwargs(tmp_path, _dev_refs())
        kwargs["dev_hyp_path"] = tmp_path / "not-there.txt"
        with pytest.raises(QualifierError, match="not found"):
            qualify(CONTEST_ID, **kwargs)

    def test_offline_qualifier_needs_both_facts(self, tmp_path):
        with pytest.raises(QualifierError, match="threshold"):
            qualify(CONTEST_ID, **_kwargs(tmp_path, _dev_refs()),
                    offline_qualifier={"qualifier_id": QUALIFIER_ID})
        with pytest.raises(QualifierError, match="qualifier_id"):
            qualify(CONTEST_ID, **_kwargs(tmp_path, _dev_refs()),
                    offline_qualifier={"threshold": 40})

    def test_offline_qualifier_scores_with_no_network(self, tmp_path):
        # No monkeypatch at all: nothing may reach out.
        receipt = qualify(CONTEST_ID, **_kwargs(tmp_path, _dev_refs()),
                          offline_qualifier={
                              "qualifier_id": QUALIFIER_ID,
                              "threshold": THRESHOLD,
                              "corpus_card_id": QUALIFIER_CORPUS,
                              "language_pair": "qaa>qab",
                              "year": 2026})
        assert receipt["passed"] is True
        assert receipt["qualifierId"] == QUALIFIER_ID

    def test_contest_id_with_a_path_separator_is_refused(self, tmp_path):
        with pytest.raises(QualifierError, match="not a slug"):
            receipt_path("../../etc/passwd", tmp_path, system="acme-nmt")


class TestLoadReceipt:
    def test_missing_receipt_names_the_command_to_run(self, tmp_path):
        with pytest.raises(QualifierError, match="contest qualify"):
            load_receipt(CONTEST_ID, tmp_path)

    def test_unparseable_receipt_is_loud(self, tmp_path):
        dest = receipt_path(CONTEST_ID, tmp_path, system="acme-nmt")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text("{not json", encoding="utf-8")
        with pytest.raises(QualifierError, match="unreadable"):
            load_receipt(CONTEST_ID, tmp_path, system="acme-nmt")


def _receipt(**over) -> dict:
    base = {"receiptVersion": "1.0.0", "contestId": CONTEST_ID,
            "qualifierId": QUALIFIER_ID, "metric": "chrf_plus_plus",
            "score": 61.0, "threshold": THRESHOLD, "passed": True,
            "selfReported": True}
    base.update(over)
    return base


class TestRequirePass:
    def test_a_passing_receipt_is_returned_verbatim(self):
        r = _receipt()
        assert require_pass(r, contest_id=CONTEST_ID,
                            qualifier_id=QUALIFIER_ID,
                            threshold=THRESHOLD) is r

    def test_failed_receipt_refused(self):
        with pytest.raises(QualifierError, match="passed=false"):
            require_pass(_receipt(passed=False, score=12.0),
                         contest_id=CONTEST_ID, qualifier_id=QUALIFIER_ID,
                         threshold=THRESHOLD)

    def test_other_contest_refused(self):
        with pytest.raises(QualifierError, match="is for contest"):
            require_pass(_receipt(contestId="another-contest"),
                         contest_id=CONTEST_ID, qualifier_id=QUALIFIER_ID,
                         threshold=THRESHOLD)

    def test_rotated_qualifier_refused(self):
        with pytest.raises(QualifierError, match="rotates yearly"):
            require_pass(_receipt(qualifierId="eval-…-qualifier-v2025"),
                         contest_id=CONTEST_ID, qualifier_id=QUALIFIER_ID,
                         threshold=THRESHOLD)

    def test_receipt_scored_against_a_lower_bar_refused(self):
        with pytest.raises(QualifierError, match="the bar moved"):
            require_pass(_receipt(threshold=30.0, score=35.0),
                         contest_id=CONTEST_ID, qualifier_id=QUALIFIER_ID,
                         threshold=THRESHOLD)

    def test_unusable_score_refused(self):
        with pytest.raises(QualifierError, match="no usable score"):
            require_pass(_receipt(score=None),
                         contest_id=CONTEST_ID, qualifier_id=QUALIFIER_ID,
                         threshold=THRESHOLD)
