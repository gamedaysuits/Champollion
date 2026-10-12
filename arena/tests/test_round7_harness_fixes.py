"""Round 7 synthetic-user findings — the harness half.

4.  `mt-eval compare` repeated its notes once per pair (six times for four
    runs) and named every pairwise table's runs "A/B", clashing with the run
    table's letters.
5.  Reads of an nmt-forge TEST set made through `mt-eval run` were not in
    forge's read ledger (read_log: the harness appends to
    <file>.reads.jsonl only when forge created it).
6.  spBLEU was computed but on no run card, compare table or significance
    test.
7.  The CI on Δ was in comparison.json only, never printed.
8.  The paired bootstrap could not be chosen from the CLI.
9.  ~9 metrics were tested without multiple-test correction, unsaid.
18. `mt-eval run --dry-run` skipped the eval-pack check the real run makes,
    so a Cree pre-flight passed and the first confirmed run stopped.
19. The dry-run summary named neither the coaching file nor the glossary.
20. The run card showed two composites about tenfold apart.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import io
import json
import re
import sys
import types
from pathlib import Path

import pytest

from mt_eval_harness import significance as sig
from mt_eval_harness.config import RunConfig


def _quiet(fn, *a, **kw):
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*a, **kw)


def _spbleu_available() -> bool:
    try:
        sig._spbleu_metric().corpus_score(["a b c d e"], [["a b c d e"]])
        return True
    except Exception:  # noqa: BLE001 — offline / no sentencepiece
        return False


needs_spbleu = pytest.mark.skipif(
    not _spbleu_available(),
    reason="spBLEU's FLORES-200 SentencePiece tokenizer is unavailable here")


# ---------------------------------------------------------------------------
# Report fixtures
# ---------------------------------------------------------------------------

REFS = [f"le chat numero {i} mange la souris grise ce matin" for i in range(30)]


def _report(path: Path, run_id: str, wrong_every: int, *, spbleu=21.0,
            plugin_untestable=False) -> Path:
    entries = []
    for i, ref in enumerate(REFS):
        pred = ref if (wrong_every and i % wrong_every) else (
            "x " + ref.split(" ", 1)[1])
        entry = {"id": i, "source": f"src {i}", "expected": ref,
                 "predicted": pred, "exact_match": pred == ref,
                 "chrf_score": 50.0}
        entries.append(entry)
    overall = {"evaluated": len(entries),
               "exact_match_rate": sum(e["exact_match"] for e in entries) / 30,
               "corpus_chrf": 60.0, "corpus_bleu": 30.0, "corpus_ter": 40.0,
               "corpus_spbleu": spbleu}
    if plugin_untestable:
        # A plugin rate with no per-segment values: never resampled, listed
        # as not tested — once, however many pairs.
        overall["plugin_metrics"] = {"terminology": {"adherence_rate": 0.5}}
    report = {"run_id": run_id,
              "config": {"model": f"m-{run_id}", "prompt_version": "naive"},
              "overall": overall, "entries": entries}
    p = path / f"{run_id}_report.json"
    p.write_text(json.dumps(report), encoding="utf-8")
    return p


@pytest.fixture
def four_reports(tmp_path):
    return [_report(tmp_path, "baseline", 1, spbleu=12.5, plugin_untestable=True),
            _report(tmp_path, "coached", 3, spbleu=20.0, plugin_untestable=True),
            _report(tmp_path, "nllb-ft", 8, spbleu=38.5, plugin_untestable=True),
            _report(tmp_path, "forge", 5, spbleu=30.2, plugin_untestable=True)]


def _compare(paths, tmp_path, **kw):
    from mt_eval_harness.compare import run_compare
    out = tmp_path / "comparison.json"
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        run_compare([str(p) for p in paths], str(out), significance=True,
                    n_bootstrap=kw.pop("n_bootstrap", 50), **kw)
    return buf.getvalue(), json.loads(out.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# 4 + 7 + 9: one explanation, letters that match the run table, CI printed,
#            p-values said to be uncorrected
# ---------------------------------------------------------------------------

class TestCompareSignificanceOutput:

    def test_notes_are_printed_once_for_all_pairs(self, four_reports, tmp_path):
        out, _ = _compare(four_reports, tmp_path)
        assert out.count("Significance Tests (") == 1
        # The decision rule is said once (scoring standard/1: chrF++ alone
        # decides); the retired composite's note is gone with its row.
        assert out.count("Decision: chrF++ (corpus) is the pre-declared") == 1
        assert "NOT the published composite_score" not in out
        assert out.count("uncorrected") == 1
        # The tests' own note (a plugin rate with no per-segment values) used
        # to print once per pair — six times for four runs.
        assert out.count("not significance-tested") == 1
        assert "terminology.adherence_rate" in out

    def test_pair_tables_use_the_run_table_letters_and_names(
            self, four_reports, tmp_path):
        out, data = _compare(four_reports, tmp_path)
        headings = re.findall(r"^  --- (.+?) ---$", out, re.M)
        assert headings == [
            "A (baseline) vs B (coached)", "A (baseline) vs C (nllb-ft)",
            "A (baseline) vs D (forge)", "B (coached) vs C (nllb-ft)",
            "B (coached) vs D (forge)", "C (nllb-ft) vs D (forge)"]
        # The C-vs-D table's columns and Δ are C and D, never a fresh A/B.
        block = out.split("--- C (nllb-ft) vs D (forge) ---", 1)[1]
        header = next(l for l in block.splitlines() if l.strip().startswith("Metric"))
        assert re.search(r"\bC\b", header) and re.search(r"\bD\b", header)
        assert "Δ (C−D)" in header and " A " not in header and " B " not in header
        chrf = next(l for l in block.splitlines() if "corpus_chrf" in l)
        assert re.search(r"\s[CD]( \(n\.s\.\))?$", chrf.rstrip())
        # comparison.json says the same letters.
        assert [p["letters"] for p in data["significance"]] == [
            ["A", "B"], ["A", "C"], ["A", "D"], ["B", "C"], ["B", "D"], ["C", "D"]]
        assert data["significance_settings"]["runs"] == {
            "A": "baseline", "B": "coached", "C": "nllb-ft", "D": "forge"}

    def test_test_notes_name_the_pair_by_its_letters(self, four_reports,
                                                    tmp_path):
        # Run D lacks two entries, so each pair with D tests 28 and drops
        # the other run's two: the note says which runs by their letters,
        # never a fresh "A/B" (in the C–D pair, "B" would be another run).
        data = json.loads(four_reports[3].read_text())
        data["entries"] = data["entries"][:-2]
        four_reports[3].write_text(json.dumps(data))
        out, cmp = _compare(four_reports, tmp_path)
        notes = cmp["significance_settings"]["notes"]
        assert ("NOTE: Testing on 28 common entries (excluded 2 from A, 0 "
                "from D) (pairs A–D)") in notes
        assert any("excluded 2 from C, 0 from D" in n for n in notes)
        assert out.count("NOTE: Testing on 28 common entries") == 3

    def test_two_runs_are_named_too(self, four_reports, tmp_path):
        out, data = _compare(four_reports[:2], tmp_path)
        assert "--- A (baseline) vs B (coached) ---" in out
        assert isinstance(data["significance"], list)
        assert "metric_name" in data["significance"][0]   # shape unchanged

    def test_the_ci_on_delta_is_printed(self, four_reports, tmp_path):
        out, data = _compare(four_reports[:2], tmp_path)
        assert "95% CI on Δ" in out
        chrf = next(t for t in data["significance"]
                    if t["metric_name"] == "corpus_chrf")
        cell = f"[{chrf['ci_lower']:+.2f}, {chrf['ci_upper']:+.2f}]"
        row = next(l for l in out.splitlines() if "↑ corpus_chrf" in l)
        assert cell in row

    def test_uncorrected_p_values_are_said_in_plain_words(
            self, four_reports, tmp_path):
        out, data = _compare(four_reports, tmp_path)
        settings = data["significance_settings"]
        n = settings["metrics_per_pair"]
        assert settings["multiple_testing_correction"] == "none"
        assert settings["pairs"] == 6
        note = settings["multiple_testing_note"]
        assert f"{n} metrics were tested per pair ({n * 6} tests over 6 pairs)" in note
        assert "by chance alone" in note and "CI on Δ" in note
        flat = " ".join(out.split())
        assert "p-values are per metric and uncorrected" in flat
        assert "not meaningful" in flat
        # the settings name what produced the numbers
        assert settings["method"] == "approximate_randomization"
        assert settings["seed"] == 12345 and settings["n_resamples"] == 50
        # the correction semantics are unchanged: p < α is "significant"
        for pair in data["significance"]:
            for t in pair["tests"]:
                assert t["significant"] == (t["p_value"] < 0.05)

    def test_the_standalone_table_says_it_too(self):
        a = [{"id": i, "expected": r, "predicted": r, "exact_match": True}
             for i, r in enumerate(REFS)]
        b = [{"id": i, "expected": r, "predicted": "q", "exact_match": False}
             for i, r in enumerate(REFS)]
        r = sig.paired_approximate_randomization(a, b, sig.exact_match_rate,
                                                 n_trials=50, metric_name="em")
        out = sig.format_significance_table([r])
        flat = " ".join(out.split())
        assert "uncorrected" in flat and "1 metric was tested" in flat
        assert "95% CI on Δ" in out

    def test_a_comparison_written_before_letters_still_renders(
            self, four_reports, tmp_path):
        from mt_eval_harness.compare import format_comparison_significance
        _, data = _compare(four_reports[:3], tmp_path)
        for pair in data["significance"]:
            del pair["letters"]
        data.pop("significance_settings")
        out = format_comparison_significance(data)
        assert "--- B (coached) vs C (nllb-ft) ---" in out


class TestSegmentCompositeLabel:

    def test_no_composite_row_under_the_standard(self, four_reports, tmp_path):
        # Scoring standard/1 retired the composite: a new comparison tests
        # and prints none, and chrF++ is the first, deciding row.
        out, data = _compare(four_reports[:2], tmp_path)
        assert "segment_composite" not in out
        names = [t["metric_name"] for t in data["significance"]]
        assert "segment_composite" not in names and names[0] == "corpus_chrf"
        assert data["significance"][0]["role"] == "primary"

    def test_an_old_comparisons_row_is_labelled_legacy(
            self, four_reports, tmp_path):
        from mt_eval_harness.compare import format_comparison_significance
        _, data = _compare(four_reports[:2], tmp_path)
        old = dict(data["significance"][0], metric_name="segment_composite",
                   system_a_score=0.07, system_b_score=0.05, role=None)
        data["significance"].append(old)
        out = format_comparison_significance(data)
        row = next(l for l in out.splitlines() if "segment_composite" in l
                   and "0." in l)
        assert "segment_composite (segment-level; legacy, retired)" in row
        assert "Legacy composite (retired, not used to decide):" in out


# ---------------------------------------------------------------------------
# 6: spBLEU everywhere BLEU is
# ---------------------------------------------------------------------------

class TestSpBleu:

    @needs_spbleu
    def test_significance_tests_include_spbleu(self, four_reports):
        a = json.loads(four_reports[0].read_text())
        b = json.loads(four_reports[2].read_text())
        res = {r.metric_name: r for r in _quiet(
            sig.run_significance_tests, a, b, n_bootstrap=50)}
        assert "corpus_spbleu" in res
        r = res["corpus_spbleu"]
        assert r.direction == "higher"
        # the tested figure is spBLEU recomputed with the report's own metric
        from sacrebleu.metrics import BLEU
        expected = BLEU(tokenize="flores200").corpus_score(
            [e["predicted"] for e in a["entries"]],
            [[e["expected"] for e in a["entries"]]]).score
        assert r.system_a_score == pytest.approx(expected, abs=1e-3)

    @needs_spbleu
    def test_fast_path_equals_the_string_path(self):
        """spBLEU is resampled from per-segment n-gram statistics, like BLEU:
        the fast path must give the string path's exact p-value."""
        a = [{"id": i, "expected": r, "predicted": r if i % 3 else "x y z"}
             for i, r in enumerate(REFS)]
        b = [{"id": i, "expected": r, "predicted": r if i % 2 else "x y"}
             for i, r in enumerate(REFS)]

        def string_only(entries):
            return sig.corpus_spbleu(entries)
        fast = sig.paired_approximate_randomization(
            a, b, sig.corpus_spbleu, n_trials=40, n_bootstrap_ci=20)
        slow = sig.paired_approximate_randomization(
            a, b, string_only, n_trials=40, n_bootstrap_ci=20)
        assert fast.p_value == slow.p_value
        assert fast.delta == slow.delta
        assert (fast.ci_lower, fast.ci_upper) == (slow.ci_lower, slow.ci_upper)

    def test_unavailable_tokenizer_is_listed_not_dropped(self, monkeypatch,
                                                          four_reports):
        def boom():
            raise RuntimeError("no sentencepiece")
        monkeypatch.setattr(sig, "_spbleu_metric", boom)
        a = json.loads(four_reports[0].read_text())
        b = json.loads(four_reports[1].read_text())
        notes: list[str] = []
        res = sig.run_significance_tests(a, b, n_bootstrap=20, notes=notes)
        assert "corpus_spbleu" not in {r.metric_name for r in res}
        assert any("corpus_spbleu (FLORES-200 tokenizer unavailable" in n
                   for n in notes)

    def test_compare_table_has_an_spbleu_row(self, four_reports, tmp_path):
        out, data = _compare(four_reports, tmp_path)
        row = next(l for l in out.splitlines() if "spBLEU (corpus)" in l)
        assert row.split()[-4:] == ["12.5", "20.0", "38.5", "30.2"]
        assert [r["corpus_spbleu"] for r in data["overall_comparison"]] == [
            12.5, 20.0, 38.5, 30.2]
        assert "chrF++/BLEU/spBLEU/TER are corpus-level" in out


class TestSpBleuOtherSurfaces:

    def test_dashboard_shows_spbleu_beside_bleu(self):
        from mt_eval_harness._dashboard_js import JS
        assert "['spBLEU', f1(o.corpus_spbleu)" in JS
        assert '<th class="num">BLEU</th><th class="num">spBLEU</th>' in JS
        assert "${f1(o.corpus_spbleu)}" in JS

    def test_publish_preview_shows_spbleu(self, tmp_path, capsys):
        from mt_eval_harness import publish
        from test_publish import _write_pair
        report_path = _write_pair(tmp_path, "sp")
        publish.publish_to_supabase(report_path, dry_run=True)
        out = capsys.readouterr().out
        assert "spBLEU:        28.0  (corpus-level, FLORES-200 SentencePiece)" in out


# ---------------------------------------------------------------------------
# 8: --method on the CLI
# ---------------------------------------------------------------------------

class TestCompareMethodFlag:

    def test_default_is_approximate_randomization(self):
        from mt_eval_harness.cli import build_parser
        args = build_parser().parse_args(["compare", "a.json", "b.json"])
        assert args.method == "approximate_randomization"

    def test_flag_choices_are_the_significance_methods(self):
        from mt_eval_harness.cli import build_parser
        p = build_parser()
        args = p.parse_args(["compare", "a.json", "b.json", "--significance",
                             "--method", "paired_bootstrap"])
        assert args.method == "paired_bootstrap"
        with pytest.raises(SystemExit):
            _quiet(p.parse_args, ["compare", "a.json", "b.json",
                                  "--method", "bogus"])
        action = next(a for a in p._subparsers._group_actions[0]
                      .choices["compare"]._actions if "--method" in a.option_strings)
        assert tuple(action.choices) == sig.SIGNIFICANCE_METHODS
        assert "paired_bootstrap" in action.help

    def test_the_cli_runs_the_bootstrap(self, four_reports, tmp_path,
                                        monkeypatch, capsys):
        from mt_eval_harness import cli
        out_json = tmp_path / "c.json"
        monkeypatch.setattr(sys, "argv", [
            "mt-eval", "compare", str(four_reports[0]), str(four_reports[1]),
            "--significance", "--method", "paired_bootstrap",
            "--n-bootstrap", "40", "-o", str(out_json)])
        cli.main()
        out = capsys.readouterr().out
        data = json.loads(out_json.read_text())
        assert {t["method"] for t in data["significance"]} == {"paired_bootstrap"}
        assert data["significance_settings"]["method"] == "paired_bootstrap"
        assert "paired bootstrap (Koehn 2004 sign-flip)" in out
        assert out.count("conservative/biased") == 1

    def test_an_unknown_method_is_refused(self, four_reports):
        from mt_eval_harness.compare import compare_reports
        with pytest.raises(ValueError, match="Unknown significance method"):
            _quiet(compare_reports, four_reports[:2], significance=True,
                   method="bogus")


# ---------------------------------------------------------------------------
# 20 + 6: the run card — one composite, spBLEU shown
# ---------------------------------------------------------------------------

def _card_files(tmp_path, overall_extra=None, *, published=True):
    log = {"run_id": "run_x", "config": {"model": "m", "target_lang": "French"},
           "results": [{"id": 0, "predicted": "a"}, {"id": 1, "predicted": "b"}]}
    overall = {"evaluated": 2, "corpus_chrf": 50.0, "corpus_bleu": 20.0,
               "corpus_spbleu": 24.3, "exact_match_count": 1,
               "exact_match_rate": 0.5,
               "confidence_intervals": {"segment_composite": {
                   "score": 0.031, "ci_lower": 0.01, "ci_upper": 0.05,
                   "n_entries": 2}}}
    if published:
        overall["published_composite"] = {
            "score": 0.3123, "quality_tier": "experimental",
            "scoring_profile": "surface-only"}
    overall.update(overall_extra or {})
    lp = tmp_path / "run_x.json"
    rp = tmp_path / "run_x_report.json"
    lp.write_text(json.dumps(log))
    rp.write_text(json.dumps({"overall": overall}))
    return lp, rp


class TestRunCard:

    # Scoring standard/1 retired the composite: a LEGACY report (one with a
    # published_composite) shows its stored score only as a legacy
    # composite (retired), never with a tier; nothing else shows one.
    def test_a_legacy_report_shows_only_the_legacy_composite(self, tmp_path):
        from mt_eval_harness.run_card import render_run_card
        text = render_run_card(*_card_files(tmp_path))
        assert "Legacy composite" in text and "0.3123" in text
        assert "retired" in text
        assert "0.0310" not in text and "Segment composite" not in text
        assert "publish records it" not in text
        assert text.count("omposite") == 1

    def test_an_unavailable_legacy_composite_shows_nothing(self, tmp_path):
        from mt_eval_harness.run_card import render_run_card
        text = render_run_card(*_card_files(tmp_path, {"published_composite": {
            "score": None, "unavailable": "KeyError: 'profile'"}}))
        assert "omposite" not in text and "0.0310" not in text

    def test_an_old_report_without_one_shows_nothing(self, tmp_path):
        from mt_eval_harness.run_card import render_run_card
        text = render_run_card(*_card_files(tmp_path, published=False))
        assert "omposite" not in text and "0.0310" not in text

    def test_spbleu_on_the_card(self, tmp_path):
        from mt_eval_harness.run_card import render_run_card
        text = render_run_card(*_card_files(tmp_path))
        line = next(l for l in text.splitlines() if "spBLEU (corpus)" in l)
        assert "24.3" in line

    def test_spbleu_not_computed_is_said(self, tmp_path):
        from mt_eval_harness.run_card import render_run_card
        text = render_run_card(*_card_files(tmp_path, {"corpus_spbleu": None}))
        line = next(l for l in text.splitlines() if "spBLEU (corpus)" in l)
        assert "not computed" in line

    def test_summary_prints_spbleu_and_no_composite(self, tmp_path, capsys):
        from mt_eval_harness.tester import _print_summary
        overall = {"total_entries": 2, "error_count": 0, "evaluated": 2,
                   "exact_match_count": 1, "exact_match_rate": 0.5,
                   "miss_count": 1, "miss_rate": 0.5, "corpus_chrf": 50.0,
                   "corpus_bleu": 20.0, "corpus_spbleu": 24.3,
                   "published_composite": {"score": 0.3123,
                                           "quality_tier": "experimental",
                                           "scoring_profile": "surface-only"},
                   "confidence_intervals": {"segment_composite": {
                       "score": 0.031, "ci_lower": 0.01, "ci_upper": 0.05}}}
        _print_summary(overall, {}, {}, {}, tmp_path / "r.json")
        out = capsys.readouterr().out
        assert "Corpus spBLEU:    24.3" in out
        # Scoring standard/1: the summary's headline is chrF++; no composite
        # (published or segment-level) and no tier is printed.
        assert "Headline:         chrF++ 50.0" in out
        assert "0.3123" not in out and "omposite" not in out
        assert "experimental" not in out


# ---------------------------------------------------------------------------
# 5: the test-set read log
# ---------------------------------------------------------------------------

class TestReadLog:

    def _watched(self, tmp_path, newline=True):
        from mt_eval_harness.read_log import read_log_path
        corpus = tmp_path / "test.json"
        corpus.write_text('{"entries": []}', encoding="utf-8")
        log = read_log_path(corpus)
        log.write_text(json.dumps({"event": "watch", "tool": "nmt-forge"})
                       + ("\n" if newline else ""), encoding="utf-8")
        return corpus, log

    def test_path_convention(self, tmp_path):
        from mt_eval_harness.read_log import READ_LOG_SUFFIX, read_log_path
        assert READ_LOG_SUFFIX == ".reads.jsonl"
        assert read_log_path(tmp_path / "a.json") == tmp_path / "a.json.reads.jsonl"
        assert read_log_path(str(tmp_path / "a.json")) == \
            Path(str(tmp_path / "a.json") + ".reads.jsonl")

    def test_appends_when_the_log_exists(self, tmp_path):
        from mt_eval_harness.read_log import record_read
        corpus, log = self._watched(tmp_path)
        rec = record_read(corpus, command="run", purpose="benchmark",
                          run_id="run_1")
        lines = log.read_text(encoding="utf-8").splitlines()
        assert len(lines) == 2 and json.loads(lines[1]) == rec
        record_read(corpus, command="run", purpose="benchmark", run_id="run_2")
        assert len(log.read_text(encoding="utf-8").splitlines()) == 3

    def test_writes_nothing_without_a_log(self, tmp_path):
        from mt_eval_harness.read_log import read_log_path, record_read
        corpus = tmp_path / "plain.json"
        corpus.write_text("{}")
        assert record_read(corpus, command="run", purpose="benchmark",
                           run_id="r") is None
        assert not read_log_path(corpus).exists()
        assert sorted(p.name for p in tmp_path.iterdir()) == ["plain.json"]

    def test_record_is_content_free_and_exact(self, tmp_path):
        from mt_eval_harness import __version__
        from mt_eval_harness.read_log import record_read
        corpus, _ = self._watched(tmp_path)
        rec = record_read(corpus, command="compare", purpose="compare",
                          run_id="cmp-1")
        assert set(rec) == {"event", "tool", "tool_version", "command",
                            "purpose", "run_id", "sha256", "ts"}
        assert rec["event"] == "read" and rec["tool"] == "mt-eval"
        assert rec["tool_version"] == __version__
        assert (rec["command"], rec["purpose"], rec["run_id"]) == (
            "compare", "compare", "cmp-1")
        assert re.fullmatch(
            r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00", rec["ts"])
        assert str(tmp_path) not in json.dumps(rec)

    def test_sha256_is_of_the_file_bytes(self, tmp_path):
        from mt_eval_harness.read_log import record_read
        corpus, _ = self._watched(tmp_path)
        rec = record_read(corpus, command="run", purpose="benchmark", run_id="r")
        assert rec["sha256"] == hashlib.sha256(corpus.read_bytes()).hexdigest()
        assert len(rec["sha256"]) == 64

    def test_never_glued_onto_an_unterminated_line(self, tmp_path):
        from mt_eval_harness.read_log import record_read
        corpus, log = self._watched(tmp_path, newline=False)
        record_read(corpus, command="run", purpose="benchmark", run_id="r")
        lines = log.read_text(encoding="utf-8").splitlines()
        assert [json.loads(l)["event"] for l in lines] == ["watch", "read"]

    def test_append_failure_warns_and_does_not_raise(self, tmp_path,
                                                    monkeypatch, capsys):
        import builtins
        from mt_eval_harness import read_log
        corpus, log = self._watched(tmp_path)
        real_open = builtins.open

        def failing_open(file, mode="r", *a, **kw):
            if str(file) == str(log) and "a" in mode:
                raise PermissionError(13, "Permission denied", str(file))
            return real_open(file, mode, *a, **kw)
        monkeypatch.setattr(builtins, "open", failing_open)
        rec = read_log.record_read(corpus, command="run", purpose="benchmark",
                                   run_id="r")
        assert "error" in rec and "PermissionError" in rec["error"]
        err = capsys.readouterr().err
        assert len(err.strip().splitlines()) == 1 and "NOT recorded" in err


PLUGIN_SRC = '''
class Copy:
    def __init__(self, manifest=None, method_dir=None):
        pass

    async def translate(self, entries, config):
        return [{"id": e["id"], "predicted": e["source"], "latency_s": 0.0,
                 "usage": {}, "error": None, "tool_calls": [],
                 "tool_call_count": 0, "metadata": {}} for e in entries]
'''


def _plugin(tmp_path: Path, src: str = PLUGIN_SRC) -> Path:
    d = tmp_path / "plug"
    d.mkdir(exist_ok=True)
    (d / "method.json").write_text(json.dumps({
        "name": "Copy", "method_id": "copy-model", "class": "pipeline",
        "entry_point": "copyplug:Copy", "version": "0.1.0"}))
    (d / "copyplug.py").write_text(src)
    return d


def _fra_corpus(tmp_path: Path) -> Path:
    c = tmp_path / "test.json"
    c.write_text(json.dumps({
        "dataset": {"language_pair": {"source": "eng", "target": "fra"}},
        "entries": [{"id": str(i), "source": f"bonjour ami numero {i} ici",
                     "reference": f"bonjour ami numero {i} ici"}
                    for i in range(4)]}))
    return c


def _execute(tmp_path, corpus, plugin_src: str = PLUGIN_SRC, **cfg):
    from mt_eval_harness.runner import execute_run
    config = RunConfig(method_path=str(_plugin(tmp_path, plugin_src)),
                       corpus_path=str(corpus), target_lang="French",
                       output_dir=str(tmp_path / "out"),
                       cache_dir=str(tmp_path / "cache"), dataset="all", **cfg)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        result = asyncio.run(execute_run(config))
    return result, buf.getvalue()


class TestRunRecordsItsRead:

    def test_a_scored_run_appends_one_record(self, tmp_path):
        from mt_eval_harness.read_log import read_log_path
        corpus = _fra_corpus(tmp_path)
        log = read_log_path(corpus)
        log.write_text('{"event": "watch", "tool": "nmt-forge"}\n')
        result, out = _execute(tmp_path, corpus)
        lines = [json.loads(l) for l in log.read_text().splitlines()]
        assert len(lines) == 2
        rec = lines[1]
        assert rec["command"] == "run" and rec["purpose"] == "benchmark"
        assert rec["run_id"] == result["run_id"]
        assert rec["sha256"] == hashlib.sha256(corpus.read_bytes()).hexdigest()
        assert f"Test-set read recorded in {log} (nmt-forge counts it)" in out
        assert result["_summary"]["read_logs"] == [str(log)]

    def test_an_unwatched_corpus_gets_nothing(self, tmp_path):
        corpus = _fra_corpus(tmp_path)
        result, out = _execute(tmp_path, corpus)
        assert not list(tmp_path.glob("*.reads.jsonl"))
        assert "Test-set read recorded" not in out
        assert "read_logs" not in result["_summary"]

    def test_a_dry_run_appends_nothing(self, tmp_path):
        from mt_eval_harness.read_log import read_log_path
        corpus = _fra_corpus(tmp_path)
        log = read_log_path(corpus)
        log.write_text('{"event": "watch", "tool": "nmt-forge"}\n')
        result, _ = _execute(tmp_path, corpus, dry_run=True)
        assert result["dry_run"] is True
        assert len(log.read_text().splitlines()) == 1

    def test_a_failed_run_appends_nothing(self, tmp_path):
        from mt_eval_harness.read_log import read_log_path
        corpus = _fra_corpus(tmp_path)
        log = read_log_path(corpus)
        log.write_text('{"event": "watch", "tool": "nmt-forge"}\n')
        failing = PLUGIN_SRC.replace('"error": None', '"error": "boom"')
        with pytest.raises(RuntimeError, match="Vacuous run"):
            _execute(tmp_path, corpus, plugin_src=failing)
        assert len(log.read_text().splitlines()) == 1

    def test_compare_reads_no_corpus_file(self):
        """compare reads reports and run logs only — never a corpus file —
        so it records nothing (by design, not by omission)."""
        import inspect
        from mt_eval_harness import compare
        src = inspect.getsource(compare)
        assert "record_read" not in src
        assert "corpus_path" not in src


# ---------------------------------------------------------------------------
# 18 + 19: the dry run checks the eval pack and names coaching + glossary
# ---------------------------------------------------------------------------

@pytest.fixture
def cree_pack(monkeypatch):
    """A controlled Cree eval pack: pyhfst + the FST, no eval standard —
    installed or not as each test says (nothing is installed for real)."""
    from mt_eval_harness import language_cards as lc
    real_pack = lc.get_eval_pack
    monkeypatch.setattr(lc, "get_eval_pack", lambda code: (
        {"pythonDeps": {"pyhfst": "pyhfst>=1.4"}, "requiresFst": True}
        if lc.resolve_code(code) == "crk" else real_pack(code)))
    monkeypatch.setattr(lc, "get_eval_metrics", lambda code: None)
    state = {"fst": False}
    monkeypatch.setattr("mt_eval_harness.plugins.fst_installer.is_fst_installed",
                        lambda code: state["fst"])

    def install(fst: bool, pyhfst: bool):
        state["fst"] = fst
        monkeypatch.setitem(sys.modules, "pyhfst",
                            types.ModuleType("pyhfst") if pyhfst else None)
    return install


def _crk_corpus(tmp_path: Path) -> Path:
    c = tmp_path / "crk.json"
    c.write_text(json.dumps({"entries": [
        {"id": str(i), "source": f"hello friend {i}", "reference": f"tânisi {i}"}
        for i in range(3)]}))
    return c


def _dry(tmp_path, corpus, **cfg):
    from mt_eval_harness.runner import execute_run
    defaults = dict(corpus_path=str(corpus), dataset="all", dry_run=True,
                    model="google/gemini-2.5-flash",
                    cache_dir=str(tmp_path / "cache"))
    defaults.update(cfg)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        result = asyncio.run(execute_run(RunConfig(**defaults)))
    return result, buf.getvalue()


def _pack_lines(out: str) -> list[str]:
    return [l for l in out.splitlines() if l.startswith("EVAL PACK:")]


class TestDryRunEvalPack:

    def test_missing_pack_is_reported_and_the_dry_run_passes(
            self, tmp_path, cree_pack):
        cree_pack(fst=False, pyhfst=False)
        result, out = _dry(tmp_path, _crk_corpus(tmp_path),
                           target_lang="Plains Cree", target_lang_code="crk")
        lines = _pack_lines(out)
        assert lines[0].startswith("EVAL PACK: missing — ")
        assert "FST morphological analyzer (Plains Cree)" in lines[0]
        assert "pyhfst>=1.4 (pyhfst)" in lines[0]
        # Round 8: a missing FST lane is an advisory — the run proceeds,
        # FST marked not computed; nothing downloads unless the user runs
        # setup; `mt-eval test <run log>` adds it afterwards.
        assert "nothing downloads unless you run: mt-eval setup --lang crk" in lines[0]
        assert "--skip-fst" in lines[0]
        assert any("the real run is not stopped by it" in l
                   and "marked not computed" in l
                   and "mt-eval test <run log>" in l for l in lines)
        pack = result["eval_pack"]
        assert pack["status"] == "missing"
        assert pack["setup_command"] == "mt-eval setup --lang crk"
        assert set(pack["missing"]) == {
            "pyhfst>=1.4 (pyhfst)", "FST morphological analyzer (Plains Cree)"}
        assert set(pack["advisory"]) == set(pack["missing"])
        assert pack["blocks_run"] is False and pack["skip_flags"] == ["--skip-fst"]

    def test_the_real_run_proceeds_on_the_same_check(self, tmp_path,
                                                      cree_pack, capsys):
        cree_pack(fst=False, pyhfst=False)
        cfg = RunConfig(corpus_path=str(_crk_corpus(tmp_path)), dataset="all",
                        target_lang="Plains Cree", target_lang_code="crk",
                        model="google/gemini-2.5-flash")
        errors = cfg.validate()
        assert not any("EVAL PACK REQUIRED" in e for e in errors), errors
        out = capsys.readouterr().out
        assert "proceeds WITHOUT FST scoring" in out
        assert "mt-eval setup --lang crk" in out

    def test_ready(self, tmp_path, cree_pack):
        cree_pack(fst=True, pyhfst=True)
        result, out = _dry(tmp_path, _crk_corpus(tmp_path),
                           target_lang="Plains Cree", target_lang_code="crk")
        assert _pack_lines(out) == [
            "EVAL PACK: ready (pyhfst>=1.4 (pyhfst), FST morphological "
            "analyzer (Plains Cree))"]
        assert result["eval_pack"]["status"] == "ready"
        assert result["eval_pack"]["missing"] == []
        assert result["eval_pack"]["setup_command"] is None

    def test_skip_fst_leaves_it_out(self, tmp_path, cree_pack):
        cree_pack(fst=False, pyhfst=False)
        result, out = _dry(tmp_path, _crk_corpus(tmp_path),
                           target_lang="Plains Cree", target_lang_code="crk",
                           skip_fst=True)
        lines = _pack_lines(out)
        assert lines[0] == "EVAL PACK: ready (nothing to install)"
        assert lines[1].startswith("EVAL PACK: left out (--skip-fst); the "
                                   "metrics they serve are marked not computed")
        assert "FST morphological analyzer (Plains Cree)" in lines[1]
        assert result["eval_pack"]["status"] == "ready"

    def test_none_needed(self, tmp_path):
        result, out = _dry(tmp_path, _fra_corpus(tmp_path), target_lang="French")
        assert _pack_lines(out) == ["EVAL PACK: none needed for French (fra)"]
        pack = result["eval_pack"]
        assert pack["status"] == "not_needed"
        assert pack["missing"] == [] and pack["setup_command"] is None

    def test_target_known_only_from_the_corpus(self, tmp_path, cree_pack):
        """No --target-lang-code: the real run's gate sees no language and
        does not stop, but scoring still needs the pack — said, not hidden."""
        cree_pack(fst=False, pyhfst=False)
        c = tmp_path / "crk_env.json"
        c.write_text(json.dumps({
            "dataset": {"language_pair": {"source": "eng", "target": "crk"}},
            "entries": [{"id": "1", "source": "hello", "reference": "tânisi"}]}))
        result, out = _dry(tmp_path, c, target_lang="Plains Cree xx")
        lines = _pack_lines(out)
        assert lines[0].startswith("EVAL PACK: missing — ")
        assert any("is not stopped by it" in l for l in lines)
        assert result["eval_pack"]["blocks_run"] is False

    def test_registry_dataset_is_reported_not_enforced(self, tmp_path,
                                                        cree_pack):
        from mt_eval_harness.config import resolve_dataset
        cree_pack(fst=False, pyhfst=False)
        corpus = _crk_corpus(tmp_path)
        reg = tmp_path / "registry.json"
        reg.write_text(json.dumps({"datasets": [{
            "id": "eval-eng-crk-test-v1", "local_path": str(corpus),
            "language_pair": {"source": "eng", "target": "crk"}}]}))
        report: list = []
        _quiet(resolve_dataset, "eval-eng-crk-test-v1", registry_path=reg,
               skip_eval_pack=True, eval_pack_report=report)
        assert report and report[0]["status"] == "missing"
        assert report[0]["stops_run"] is False   # FST lane only: advisory
        _quiet(resolve_dataset, "eval-eng-crk-test-v1", registry_path=reg)

    def test_json_summary_carries_eval_pack(self, tmp_path, cree_pack):
        from mt_eval_harness.cli import _run_json_summary
        cree_pack(fst=False, pyhfst=False)
        result, _ = _dry(tmp_path, _crk_corpus(tmp_path),
                         target_lang="Plains Cree", target_lang_code="crk")
        summary = _run_json_summary([result], multi=False)
        assert summary["eval_pack"]["status"] == "missing"
        assert summary["eval_pack"]["setup_command"] == "mt-eval setup --lang crk"
        assert "coaching_file" in summary and "glossary_file" in summary

    def test_standard_dependencies_and_the_optional_add_on(self, monkeypatch):
        """A missing non-FST dependency names --skip-eval-standard; an
        uninstalled eval-standard package is optional and said as such."""
        from mt_eval_harness import language_cards as lc
        from mt_eval_harness.config import (
            eval_pack_json, eval_pack_lines, eval_pack_status)
        monkeypatch.setattr(lc, "get_eval_pack", lambda code: {
            "pythonDeps": {"zz_absent_dep": "zz-absent-dep>=1"}})
        monkeypatch.setattr(lc, "get_eval_metrics", lambda code: {
            "zz-metric": {"module": "zz_absent_standard.metrics",
                          "class": "ZZ"}})
        monkeypatch.setattr(lc, "get_eval_standard", lambda code: {
            "package": "zz-standard", "pip": "zz-standard==1.0"})
        st = eval_pack_status({"id": "x", "language_pair": {"target": "fra"}})
        assert st["status"] == "missing"
        assert st["missing"] == ["zz-absent-dep>=1 (zz_absent_dep)"]
        assert st["skip_flags"] == ["--skip-eval-standard"]
        lines = eval_pack_lines(st, blocks_run=True)
        assert "or pass --skip-eval-standard to score without them" in lines[0]
        opt = next(l for l in lines if l.startswith("EVAL PACK: optional — "))
        assert "zz-standard is not installed" in opt
        assert "pip install zz-standard==1.0" in opt and "zz-metric" in opt
        js = eval_pack_json(st, blocks_run=True)
        assert js["optional_missing"] == {
            "package": "zz-standard", "metrics": ["zz-metric"],
            "install_command": "python3 -m pip install zz-standard==1.0"}
        # a non-FST dependency still stops the real run
        assert st["stops_run"] is True and js["blocks_run"] is True

    def test_the_old_disclaimer_is_gone(self, tmp_path):
        _, out = _dry(tmp_path, _fra_corpus(tmp_path), target_lang="French")
        assert "not in a dry run" not in out


class TestDryRunInputs:

    def test_coaching_and_glossary_paths(self, tmp_path):
        coach = tmp_path / "coach.txt"
        coach.write_text("Use formal register.")
        gloss = tmp_path / "gloss.json"
        gloss.write_text(json.dumps({"friend": "ami"}))
        result, out = _dry(tmp_path, _fra_corpus(tmp_path),
                           target_lang="French", coaching_file=str(coach),
                           prompt_version="coached", glossary_file=str(gloss))
        assert f"  Coaching:    {coach}" in out
        assert f"  Glossary:    {gloss} — glossary of 1 term(s)" in out
        assert result["coaching_file"] == str(coach)
        assert result["glossary_file"] == str(gloss)

    def test_none_is_said(self, tmp_path):
        result, out = _dry(tmp_path, _fra_corpus(tmp_path), target_lang="French")
        assert "  Coaching:    none" in out
        assert "  Glossary:    none (terminology adherence inactive)" in out
        assert result["coaching_file"] is None and result["glossary_file"] is None

    def test_glossary_from_the_coaching_dictionary(self, tmp_path):
        coach = tmp_path / "coach.json"
        coach.write_text(json.dumps({"dictionary": {"friend": "ami"}}))
        result, out = _dry(tmp_path, _fra_corpus(tmp_path),
                           target_lang="French", coaching_file=str(coach),
                           prompt_version="coached")
        assert f"  Glossary:    {coach} (its dictionary) — glossary of 1" in out
        assert result["glossary_file"] == str(coach)
        assert "coaching file's dictionary" in result["glossary"]

    def test_a_method_plugin_takes_no_coaching(self, tmp_path):
        result, out = _dry(tmp_path, _fra_corpus(tmp_path),
                           target_lang="French",
                           method_path=str(_plugin(tmp_path)))
        assert "  Coaching:    n/a (the method translates by itself" in out
        assert result["coaching_file"] is None
