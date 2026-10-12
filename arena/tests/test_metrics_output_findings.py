"""Synthetic-user findings on the harness's metrics and output surfaces.

Each class pins one finding from the synthetic-user round (researcher,
hospital and agent personas). They are behaviour tests of what a user sees:
argument spellings, table readability, where a file was written, what a
printed number is called, and whether an error is one line or a traceback.
No published value or metric definition is changed by any of these fixes —
the tests assert labels, plumbing and output, not new numbers.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from mt_eval_harness.cli import _resolve_recommend_pair, build_parser


# ---------------------------------------------------------------------------
# 1. `recommend` takes the pair in both spellings
# ---------------------------------------------------------------------------


class TestRecommendAcceptsBothPairSpellings:
    """`mt-eval recommend --source eng --target sme` died with "unrecognized
    arguments" because recommend only took positionals while `corpora` and
    `list datasets` take --source/--target. Both forms now resolve to the
    same pair; the positional form keeps working."""

    @pytest.mark.parametrize("argv", [
        ["recommend", "eng", "sme"],
        ["recommend", "--source", "eng", "--target", "sme"],
        ["recommend", "--source-code", "eng", "--target-code", "sme"],
        ["recommend", "eng", "--target", "sme"],
        ["recommend", "--target", "sme", "--source", "eng", "--json"],
    ])
    def test_every_spelling_resolves_to_the_same_pair(self, argv):
        args = build_parser().parse_args(argv)
        assert _resolve_recommend_pair(args) == ("eng", "sme")

    def test_same_code_twice_is_fine(self):
        args = build_parser().parse_args(
            ["recommend", "eng", "sme", "--source", "eng"])
        assert _resolve_recommend_pair(args) == ("eng", "sme")

    def test_conflicting_codes_are_an_error_not_a_silent_pick(self):
        args = build_parser().parse_args(
            ["recommend", "eng", "sme", "--source", "fra"])
        with pytest.raises(ValueError, match="source given twice"):
            _resolve_recommend_pair(args)

    def test_missing_target_names_both_forms(self):
        args = build_parser().parse_args(["recommend", "eng"])
        with pytest.raises(ValueError, match="--source <code> --target"):
            _resolve_recommend_pair(args)

    def test_main_parser_still_does_not_abbreviate(self):
        # The flag form must not be bought by re-enabling abbreviation on the
        # main parser (that broke shipped flags on Python 3.12, 2026-09-07).
        assert build_parser().allow_abbrev is False

    def test_main_dispatch_prints_guidance_for_the_flag_form(
            self, monkeypatch, capsys):
        from mt_eval_harness import cli as cli_mod
        monkeypatch.setattr(sys, "argv", [
            "mt-eval", "recommend", "--source", "eng", "--target", "sme",
            "--json"])
        cli_mod.main()
        payload = json.loads(capsys.readouterr().out)
        assert payload["pair"] == {"source": "eng", "target": "sme"}


# ---------------------------------------------------------------------------
# Shared fixtures: a real plugin run (no network) through execute_run
# ---------------------------------------------------------------------------

import asyncio

from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import execute_run

TRANSLATE_ONLY = '''
class Upper:
    async def translate(self, entries, config):
        return [{"id": e["id"], "predicted": e["source"].upper(),
                 "latency_s": 0.0, "usage": {}, "error": None,
                 "metadata": {}} for e in entries]
'''


def _plugin_dir(tmp_path: Path, src: str = TRANSLATE_ONLY, name="plug",
                **manifest) -> Path:
    d = tmp_path / name
    d.mkdir()
    (d / "method.json").write_text(json.dumps(
        {"name": "Upper words", "entry_point": "m:Upper", **manifest}))
    (d / "m.py").write_text(src)
    return d


def _corpus(tmp_path: Path, n: int = 12) -> Path:
    corpus = tmp_path / "corpus.json"
    corpus.write_text(json.dumps({
        "dataset": {"language_pair": {"source": "eng", "target": "fra"}},
        "entries": [{"id": str(i), "source": f"hello world {i}",
                     "reference": f"HELLO monde {i}", "difficulty": 1 + i % 2}
                    for i in range(n)]}))
    return corpus


def _plugin_run(tmp_path: Path, plugin: Path, out="out") -> tuple[dict, Path]:
    cfg = RunConfig(method_path=str(plugin), corpus_path=str(_corpus(tmp_path)),
                    target_lang="French", output_dir=str(tmp_path / out),
                    cache_dir=str(tmp_path / "cache"), dataset="all")
    log = asyncio.run(execute_run(cfg))
    report = next((tmp_path / out).glob("*_report.json"))
    return log, report


# ---------------------------------------------------------------------------
# 2. The run comparison table is readable: metrics as rows, full names
# ---------------------------------------------------------------------------

from mt_eval_harness.compare import (
    default_comparison_path,
    format_comparison_table,
    run_compare,
)


def _rows():
    plug = {
        "code_switching.avg_code_switching_rate": 0.6,
        "code_switching.entries_with_code_switching": 12,
        "code_switching.entries_with_code_switching_pct": 0.4,
        "hallucination.entries_flagged_hallucination_pct": 0.1,
        "giellalt_fst_validity.total_words_checked": 249,
    }
    base = {"run_id": "run_a", "model": "base", "tools": False, "entries": 30,
            "exact_match": 0.1, "corpus_chrf": 20.0, "corpus_bleu": 0.5,
            "corpus_ter": 80.0, "comet_score": None, "total_cost": None,
            "avg_latency": 0.2, **plug}
    other = dict(base, run_id="run_b", model="trained", corpus_chrf=83.5,
                 total_cost=0.0123,
                 **{"code_switching.avg_code_switching_rate": 0.08})
    return [base, other]


class TestComparisonTableIsReadable:
    """The RUN COMPARISON table had ~30 columns with headers cut to ten
    characters (avg_fst_va, total_word, entries_wi, entries_wi …)."""

    def test_metrics_are_rows_with_full_names(self):
        out = format_comparison_table(_rows())
        for full in ("entries_with_code_switching_pct",
                     "entries_with_code_switching",
                     "avg_code_switching_rate", "total_words_checked"):
            assert full in out
        assert "entries_wi " not in out
        # one column per run, lettered like the significance table
        header = next(l for l in out.splitlines() if l.strip().startswith("Metric"))
        assert header.split()[-2:] == ["A", "B"]
        assert "A  run_a" in out and "B  run_b" in out

    def test_lower_is_better_rows_are_marked(self):
        out = format_comparison_table(_rows())
        ter = next(l for l in out.splitlines() if "TER (corpus)" in l)
        cs = next(l for l in out.splitlines() if "avg_code_switching_rate" in l)
        chrf = next(l for l in out.splitlines() if "chrF++ (corpus)" in l)
        assert ter.strip().startswith("↓") and cs.strip().startswith("↓")
        assert chrf.strip().startswith("↑")

    def test_unknown_cost_is_unknown_never_zero(self):
        cost = next(l for l in format_comparison_table(_rows()).splitlines()
                    if "Total cost" in l)
        assert "unknown" in cost and "$0.0123" in cost


# ---------------------------------------------------------------------------
# 3. compare writes beside its inputs, says where, and says what it takes
# ---------------------------------------------------------------------------


class TestCompareOutputLocation:

    def test_default_is_never_one_runs_folder(self, tmp_path):
        # Round 11: reports in different folders go to comparisons/ in their
        # nearest common folder — no longer the FIRST report's folder.
        # (named for the runs compared since Round 12: comparison_filename)
        from mt_eval_harness.compare import comparison_filename
        two = [tmp_path / "res" / "a_report.json", tmp_path / "b_report.json"]
        assert default_comparison_path(two) == (
            tmp_path.resolve() / "comparisons" / comparison_filename(two))
        same = [tmp_path / "res" / "a_report.json",
                tmp_path / "res" / "b_report.json"]
        assert default_comparison_path(same) == (
            (tmp_path / "res").resolve() / comparison_filename(same))

    def test_help_names_report_files(self, capsys):
        with pytest.raises(SystemExit):
            build_parser().parse_args(["compare", "--help"])
        text = " ".join(capsys.readouterr().out.split())
        assert "_report.json" in text
        assert "RunLog JSON files" not in text
        assert "never one run's own folder" in text


# ---------------------------------------------------------------------------
# 4 + 6 + 11 + 12. What a printed number IS
# ---------------------------------------------------------------------------

from mt_eval_harness.run_card import (
    cost_label,
    fst_lines,
    prompt_label,
    render_run_card,
)


class TestCorpusVersusSentenceMeansAreLabelled:
    """Headline BLEU 0.5 beside per-tier BLEU 10.2: the headline is
    corpus-level, the tier value a mean of sentence scores. Values are
    unchanged; both are now named."""

    def test_run_card_names_both(self, tmp_path):
        log, report_path = _plugin_run(tmp_path, _plugin_dir(tmp_path))
        log_path = report_path.with_name(
            report_path.name.replace("_report.json", ".json"))
        card = render_run_card(log_path, report_path)
        report = json.loads(report_path.read_text())
        assert "BLEU (corpus)" in card and "chrF++ (corpus)" in card
        assert "BLEU*" in card and "mean of per-sentence scores" in card
        # the values are the report's, untouched
        assert f"{report['overall']['corpus_bleu']:.1f}" in card
        tier = report["by_difficulty"]["1"]
        assert f"{tier['avg_bleu']:.1f}" in card

    def test_test_summary_names_both(self, tmp_path, capsys):
        _plugin_run(tmp_path, _plugin_dir(tmp_path))
        out = capsys.readouterr().out
        assert "Corpus BLEU:" in out
        assert "BLEU*" in out and "mean of per-sentence scores" in out
        assert "corpus chrF++ CI" in out


class TestFstAcceptanceSaysWhichNumberIsPublished:
    """Run card printed 'Word validity 11/249 (4.4%)' (words pooled) while
    the published fst_acceptance_rate was 0.0389 (mean of per-entry rates)."""

    def test_both_numbers_named_published_first(self):
        rows = fst_lines({"avg_fst_validity": 0.0389,
                          "corpus_validity_rate": 11 / 249,
                          "total_words_checked": 249, "total_valid_words": 11})
        (k1, v1), (k2, v2) = rows
        assert k1 == "FST acceptance" and v1.startswith("3.9%")
        assert "published" in v1 and "mean of per-entry rates" in v1
        assert k2 == "Words accepted" and "11/249 (4.4%" in v2

    def test_publish_takes_the_mean_of_per_entry_rates(self):
        # The doc fix rests on this: publish's fst_acceptance_rate is the
        # plugin's avg_fst_validity, not corpus_validity_rate.
        import inspect

        from mt_eval_harness import publish
        # derive_scores is where assemble_run_card reads the FST diagnostic
        # (the one reading of every diagnostic beside the chrF++ headline).
        src = inspect.getsource(publish.derive_scores)
        assert 'rate = fst_data.get("avg_fst_validity")' in src
        assert "derive_scores(report, run_log, report_path)" in \
            inspect.getsource(publish.assemble_run_card)

    def test_unavailable_fst_is_not_a_number(self):
        assert fst_lines({"error": "FST unavailable: x", "avg_fst_validity": None}) \
            == [("FST acceptance", "FST unavailable: x")]


class TestLocalCostLabel:
    """A loopback --provider local run read 'unknown (model has no
    published price)'. The stored cost stays None; only the words change."""

    def test_loopback_local_has_no_api_bill(self):
        assert cost_label(None, {"provider": "local"},
                          {"endpoint_locality": "loopback"}) \
            == "$0 API cost (runs on this machine)"

    def test_local_name_alone_is_not_enough(self):
        # --provider local --base-url https://api.groq.com/… is billed.
        assert "unknown" in cost_label(None, {"provider": "local"}, {})

    def test_known_cost_and_other_cases(self):
        assert cost_label(0.5, {}, {}) == "$0.5000"
        assert "engine" in cost_label(None, {"mt_method": "deepl"}, {})
        assert "plugin" in cost_label(None, {"method_path": "./p"}, {})
        assert cost_label(None, {"provider": "openrouter"}, {}) \
            == "unknown (model has no published price)"

    def test_run_card_renders_it(self, tmp_path):
        log, report = _plugin_run(tmp_path, _plugin_dir(tmp_path))
        log_path = report.with_name(report.name.replace("_report.json", ".json"))
        data = json.loads(log_path.read_text())
        data["config"]["provider"] = "local"
        data["config"]["method_path"] = ""
        data["provenance"]["endpoint_locality"] = "loopback"
        log_path.write_text(json.dumps(data))
        assert "$0 API cost (runs on this machine)" in render_run_card(log_path, report)


class TestPromptConditionForSelfTranslatingMethods:

    def test_prompt_label(self):
        assert prompt_label({"prompt_version": "naive"}) == "naive"
        assert prompt_label({"prompt_version": "naive", "method_path": "./p"}) \
            .startswith("n/a")
        assert prompt_label({"prompt_version": "naive", "mt_method": "deepl"}) \
            .startswith("n/a")

    def test_plugin_run_publishes_its_class_not_naive(self, tmp_path):
        from mt_eval_harness.publish import assemble_run_card
        _log, report = _plugin_run(
            tmp_path, _plugin_dir(tmp_path, method_id="up", **{"class": "pipeline"}))
        card, _id, _fp = assemble_run_card(report)
        assert card["condition"] == "pipeline"

    def test_undeclared_plugin_is_custom_plugin(self, tmp_path):
        from mt_eval_harness.publish import assemble_run_card
        _log, report = _plugin_run(tmp_path, _plugin_dir(tmp_path))
        card, _id, _fp = assemble_run_card(report)
        assert card["condition"] == "custom-plugin"
        assert card["method_card"]["class"] == "custom-plugin"

    def test_condition_vocabulary_has_no_check_that_rejects_it(self):
        # run_cards.condition is free text; the only condition CHECK in the
        # migrations is queue_items' (naive/coached/engine), which a run
        # card never meets.
        root = Path(__file__).resolve().parents[2] / "mt-eval-arena" / "supabase" / "migrations"
        if not root.is_dir():
            pytest.skip("monorepo migrations not present")
        import re
        checks = [m for f in sorted(root.glob("*.sql"))
                  for m in re.findall(r"constraint\s+(\w*condition\w*)",
                                      f.read_text(), flags=re.I)]
        assert checks and all(c.startswith("queue_items") for c in checks)


# ---------------------------------------------------------------------------
# 5 + 7. Significance: the composite's real name, and which way is better
# ---------------------------------------------------------------------------

from mt_eval_harness import significance as sig
from mt_eval_harness.metric_direction import better_side, direction_of


def _entries(preds, refs, cs=None):
    out = []
    for i, (p, r) in enumerate(zip(preds, refs)):
        e = {"id": i, "source": f"s{i}", "expected": r, "predicted": p,
             "exact_match": p == r, "error": None}
        if cs is not None:
            e["plugin_metrics"] = {"code_switching": {"code_switching_rate": cs[i]}}
        out.append(e)
    return out


def _report(entries, cs_avg=None):
    overall = {}
    if cs_avg is not None:
        overall["plugin_metrics"] = {
            "code_switching": {"avg_code_switching_rate": cs_avg}}
    return {"entries": entries, "overall": overall}


class TestDirectionComesFromTheRegistry:

    @pytest.mark.parametrize("name,direction", [
        ("corpus_chrf", "higher"), ("corpus_bleu", "higher"),
        ("corpus_ter", "lower"), ("segment_composite", "higher"),
        ("code_switching.avg_code_switching_rate", "lower"),
        ("code_switching.entries_with_code_switching_pct", "lower"),
        ("hallucination.avg_hallucination_rate", "lower"),
        ("hallucination.max_hallucination_rate", "lower"),
        ("giellalt_fst_validity.avg_fst_validity", "higher"),
        ("giellalt_fst_validity.morph_coverage", "neutral"),
        ("terminology.avg_terminology_adherence", "higher"),
        ("total_cost", "lower"),
    ])
    def test_known_names(self, name, direction):
        assert direction_of(name) == direction

    def test_undeclared_is_none_not_guessed(self):
        assert direction_of("writing_style.avg_formality_score") is None
        assert direction_of("some_plugin.whatever") is None

    def test_every_alias_points_at_a_registry_entry(self):
        from mt_eval_harness import metric_direction as md
        ids = md._registry_entries()
        for target in list(md._NAME_TO_ID.values()) + list(md._PLUGIN_KEY_TO_ID.values()):
            assert target in ids, target

    def test_better_side(self):
        assert better_side("lower", 0.6, 0.08) == "B"
        assert better_side("higher", 20.0, 83.5) == "B"
        assert better_side("higher", 1.0, 1.0) == "tie"
        assert better_side("neutral", 1.0, 2.0) is None


class TestSegmentCompositeIsNotThePublishedComposite:

    def _results(self):
        refs = [f"w{i} x y z" for i in range(20)]
        a = _report(_entries(refs, refs))
        b = _report(_entries(["q q"] * 20, refs))
        return {r.metric_name: r for r in sig.run_significance_tests(
            a, b, n_bootstrap=50)}

    def test_the_retired_composite_is_not_tested(self):
        # Scoring standard/1 retired the weighted composite: the paired
        # battery tests chrF++ first (the primary) and no composite at all.
        results = list(self._results().values())
        names = [r.metric_name for r in results]
        assert "segment_composite" not in names and "composite_score" not in names
        assert names[0] == "corpus_chrf" and results[0].role == "primary"

    def test_legacy_composite_function_is_kept(self):
        # composite_score stays for cards scored before the standard.
        refs = [f"w{i} x y z" for i in range(20)]
        assert 0.0 < sig.composite_score(_entries(refs, refs)) <= 1.0

    def test_table_names_the_decision_metric(self):
        out = sig.format_significance_table(list(self._results().values()))
        assert "segment_composite" not in out
        flat = " ".join(out.split())
        assert "pre-declared primary metric" in flat
        assert "Verdict: A is better than B on chrF++" in flat
        assert "Diagnostics (not used to decide):" in out

    def test_old_comparison_json_reads_as_legacy_segment_composite(self):
        legacy = sig.SignificanceResult(
            metric_name="composite_score", system_a_score=0.04,
            system_b_score=0.26, delta=-0.22, p_value=0.01, n_bootstrap=100,
            confidence_level=0.95, significant=True, winner="B",
            ci_lower=-0.3, ci_upper=-0.1, method="approximate_randomization")
        out = sig.format_significance_table([legacy])
        row = next(l for l in out.splitlines() if "0.04" in l)
        assert "segment_composite" in row and "composite_score" not in row
        assert "legacy, retired" in row
        assert "NOT the published composite_score" in out
        flat = " ".join(out.split())
        assert "LEGACY row" in flat and "chrF++ decides" in flat
        # A legacy row never yields a verdict: only chrF++ decides.
        assert "Verdict:" not in out


class TestSignificanceTableSaysWhoIsBetter:

    def test_lower_is_better_rate_going_up_is_a_regression(self):
        # code switching 0.08 → 0.60 (A worse than B): Δ is +0.52, which
        # read like a win; it is B that is better.
        refs = [f"w{i} x y z" for i in range(30)]
        a = _report(_entries(refs, refs, cs=[0.6] * 30), cs_avg=0.6)
        b = _report(_entries(refs, refs, cs=[0.08] * 30), cs_avg=0.08)
        res = {r.metric_name: r for r in sig.run_significance_tests(
            a, b, n_bootstrap=100)}
        r = res["code_switching.avg_code_switching_rate"]
        assert r.delta > 0 and r.direction == "lower"
        assert r.significant and r.winner == "B"   # JSON winner: direction-aware
        out = sig.format_significance_table(list(res.values()))
        line = next(l for l in out.splitlines()
                    if "avg_code_switching_rate" in l)
        assert line.strip().startswith("↓")
        assert line.rstrip().endswith("B")

    def test_trained_model_passed_second_reads_as_B_better(self):
        # School persona: baseline first, trained model second, +63.5 chrF++
        # printed as -63.52 with no hint who won.
        refs = [f"alpha{i} beta gamma delta" for i in range(30)]
        a = _report(_entries(["zzz"] * 30, refs))
        b = _report(_entries(refs, refs))
        results = sig.run_significance_tests(a, b, n_bootstrap=100)
        out = sig.format_significance_table(results)
        assert "Δ = A − B" in out
        chrf = next(l for l in out.splitlines() if "corpus_chrf" in l)
        assert " -" in chrf and chrf.rstrip().endswith("B")
        ter = next(l for l in out.splitlines() if "corpus_ter" in l)
        assert ter.strip().startswith("↓") and ter.rstrip().endswith("B")

    def test_not_significant_is_marked(self):
        r = sig.SignificanceResult(
            metric_name="corpus_chrf", system_a_score=42.96, system_b_score=41.80,
            delta=1.16, p_value=0.142, n_bootstrap=100, confidence_level=0.95,
            significant=False, winner=None, ci_lower=-0.8, ci_upper=3.1)
        out = sig.format_significance_table([r])
        assert next(l for l in out.splitlines()
                    if "corpus_chrf" in l).rstrip().endswith("A (n.s.)")

    def test_undeclared_direction_names_no_winner(self):
        refs = [f"w{i} x y z" for i in range(30)]

        def rep(val):
            entries = _entries(refs, refs)
            for e in entries:
                e["plugin_metrics"] = {"writing_style": {"formality_score": val}}
            return {"entries": entries, "overall": {"plugin_metrics": {
                "writing_style": {"avg_formality_score": float(val)}}}}

        res = {r.metric_name: r for r in sig.run_significance_tests(
            rep(0.9), rep(0.1), n_bootstrap=100)}
        r = res["writing_style.avg_formality_score"]
        assert r.significant and r.winner is None and r.direction is None
        out = sig.format_significance_table([r])
        assert next(l for l in out.splitlines()
                    if "avg_formality_score" in l).rstrip().endswith("?")
        assert "no direction declared" in out

    def test_paired_test_convention_is_unchanged_for_external_callers(self):
        # forge's ci_scoring flips winners itself for its lower lanes and
        # relies on "A iff delta > 0" for a metric_fn without the flag.
        refs = [f"w{i} x y z" for i in range(30)]
        a = _entries(["q q q q"] * 30, refs)
        b = _entries(refs, refs)

        def plain_mean(entries):
            return sum(1.0 for e in entries if e["predicted"] != e["expected"]) / len(entries)

        res = sig.paired_approximate_randomization(
            a, b, plain_mean, n_trials=100, n_bootstrap_ci=50,
            metric_name="hallucination.avg_hallucination_rate")
        assert res.delta > 0 and res.winner == "A"


# ---------------------------------------------------------------------------
# 8. A coaching JSON's dictionary turns terminology adherence on
# ---------------------------------------------------------------------------

from mt_eval_harness.plugin_discovery import discover_metric_plugins, run_glossary

COOKBOOK = {
    "grammar_rules": ["Adjectives agree with the noun."],
    "dictionary": {"dashboard": "tableau de bord", "settings": ["paramètres", "réglages"]},
    "style_notes": "Prefer active voice.",
}


class TestCoachingDictionaryActivatesTerminology:
    """With a cookbook-shaped coaching JSON the run still said
    'Terminology: loaded (TerminologyPlugin — no glossary (metric inactive))'
    — nothing on the command line could set the glossary."""

    def _terminology(self, config):
        plugins = discover_metric_plugins(config, skip_fst=True)
        return next(p for p in plugins if p.name == "terminology")

    def test_coaching_json_dictionary_is_the_glossary(self, tmp_path, capsys):
        coaching = tmp_path / "coaching.json"
        coaching.write_text(json.dumps(COOKBOOK), encoding="utf-8")
        config = {"target_lang": "French", "coaching_file": str(coaching)}
        plugin = self._terminology(config)
        out = capsys.readouterr().out
        assert "glossary of 2 term(s) from the coaching file's dictionary" in out
        assert "metric inactive" not in out
        hit = plugin.compute({"source": "Open the dashboard settings",
                              "predicted": "Ouvrez les réglages du tableau de bord"})
        assert hit["terminology_adherence"] == 1.0 and hit["term_total"] == 2
        miss = plugin.compute({"source": "Open the dashboard",
                               "predicted": "Ouvrez le panneau"})
        assert miss["terminology_adherence"] == 0.0

    def test_markdown_coaching_leaves_it_inactive_and_says_how(self, tmp_path):
        md = tmp_path / "coaching.md"
        md.write_text("# Rules\n- be formal\n", encoding="utf-8")
        glossary, status = run_glossary({"coaching_file": str(md)})
        assert glossary is None and "--glossary" in status
        plugin = self._terminology({"target_lang": "French", "coaching_file": str(md)})
        assert plugin.compute({"source": "a", "predicted": "b"})[
            "terminology_adherence"] is None

    def test_no_coaching_names_the_way_to_turn_it_on(self):
        _g, status = run_glossary({})
        assert "--glossary" in status and "same file for every run" in status

    def test_coaching_source_says_it_is_self_referential(self, tmp_path):
        coaching = tmp_path / "coaching.json"
        coaching.write_text(json.dumps(COOKBOOK), encoding="utf-8")
        _g, status = run_glossary({"coaching_file": str(coaching)})
        assert "scored against its own coaching" in status

    def test_glossary_file_is_an_evaluation_input_for_any_run(self, tmp_path):
        g = tmp_path / "terms.json"
        g.write_text(json.dumps({"blood pressure": ["tension artérielle"]}),
                     encoding="utf-8")
        coaching = tmp_path / "coaching.json"
        coaching.write_text(json.dumps(COOKBOOK), encoding="utf-8")
        # a naive run (no coaching) gets it; it beats a coaching dictionary
        for cfg in ({"glossary_file": str(g)},
                    {"glossary_file": str(g), "coaching_file": str(coaching)}):
            glossary, status = run_glossary(cfg)
            assert glossary == {"blood pressure": ["tension artérielle"]}
            assert "--glossary terms.json" in status
        wrapped = tmp_path / "wrapped.json"
        wrapped.write_text(json.dumps({"dictionary": {"x": "y"}}), encoding="utf-8")
        assert run_glossary({"glossary_file": str(wrapped)})[0] == {"x": ["y"]}

    def test_a_bad_glossary_fails_loudly(self, tmp_path):
        with pytest.raises(SystemExit):
            run_glossary({"glossary_file": str(tmp_path / "missing.json")})
        empty = tmp_path / "empty.json"
        empty.write_text("{}", encoding="utf-8")
        with pytest.raises(SystemExit):
            run_glossary({"glossary_file": str(empty)})

    def test_run_records_the_glossary_and_test_can_override(self):
        args = build_parser().parse_args(
            ["run", "--corpus", "x", "--glossary", "terms.json"])
        assert args.glossary == "terms.json"
        targs = build_parser().parse_args(["test", "log.json", "--glossary", "g.json"])
        assert targs.glossary == "g.json"

    def test_run_help_says_both_formats_work(self, capsys):
        with pytest.raises(SystemExit):
            build_parser().parse_args(["run", "--help"])
        text = " ".join(capsys.readouterr().out.split())
        assert "Markdown, plain text or JSON" in text
        assert '"dictionary"' in text and "terminology" in text

    def test_docs_agree_on_the_coaching_file(self):
        root = Path(__file__).resolve().parents[2] / "cli" / "website" / "docs"
        if not root.is_dir():
            pytest.skip("monorepo docs not present")
        guide = (root / "build-mt-for-your-language.md").read_text()
        tutorial = (root / "network" / "tutorials" / "coached-llm-prompting.md").read_text()
        assert "--coaching-file coaching.json" in guide
        assert "Markdown, plain text or JSON" in guide
        assert "Markdown or plain-text file coaches too" in tutorial
        assert "terminology adherence" in tutorial.lower()


# ---------------------------------------------------------------------------
# 9. The end-of-run publish hint, and publish on a missing path
# ---------------------------------------------------------------------------

from mt_eval_harness import cli as cli_mod


class TestPublishHint:

    def test_hint_has_the_real_path_and_a_dry_run_first(self, tmp_path):
        _log, report = _plugin_run(tmp_path, _plugin_dir(tmp_path), out="res dir")
        lines = cli_mod._publish_hint(report)
        text = "\n".join(lines)
        import shlex
        assert f"mt-eval publish {shlex.quote(str(report))} --dry-run" in text
        assert text.index("--dry-run") < text.index("--prod")
        # an unregistered corpus publishes scores only — said up front
        assert "scores only" in text

    def test_run_prints_it(self, tmp_path, capsys, monkeypatch):
        monkeypatch.setattr(sys.stdin, "isatty", lambda: False, raising=False)
        _log, report = _plugin_run(tmp_path, _plugin_dir(tmp_path))
        out = capsys.readouterr().out
        assert f"mt-eval publish {report} --dry-run" in out
        assert f"mt-eval publish {report.name} --prod" not in out

    def test_local_only_corpus_says_text_stays(self, tmp_path, monkeypatch):
        from mt_eval_harness import publish
        monkeypatch.setattr(publish, "assemble_run_card", lambda p: (
            {"dataset": {"id": "ward-test", "transmission": "local-only"}}, "u", "f"))
        monkeypatch.setattr(publish, "_lookup_registry_entry", lambda i: None)
        report = tmp_path / "r_report.json"
        report.write_text("{}")
        text = "\n".join(cli_mod._publish_hint(report))
        assert "local-only" in text and "never leave this machine" in text
        assert "--dry-run" in text

    def test_quarantined_corpus_gets_no_publish_command(self, tmp_path, monkeypatch):
        from mt_eval_harness import publish
        monkeypatch.setattr(publish, "assemble_run_card", lambda p: (
            {"dataset": {"id": "q-set"}}, "u", "f"))
        monkeypatch.setattr(publish, "_lookup_registry_entry", lambda i: {
            "id": "q-set", "quarantine": True, "quarantine_reason": "improper subset"})
        report = tmp_path / "r_report.json"
        report.write_text("{}")
        text = "\n".join(cli_mod._publish_hint(report))
        assert "quarantined" in text and "mt-eval publish" not in text

    def test_publish_missing_path_is_one_line(self, tmp_path, monkeypatch, capsys):
        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(sys, "argv", [
            "mt-eval", "publish", "run_x_report.json", "--dry-run"])
        with pytest.raises(SystemExit) as exc:
            cli_mod.main()
        assert exc.value.code == 1
        err = capsys.readouterr().err.strip()
        assert len(err.splitlines()) == 1
        assert "no report file at 'run_x_report.json'" in err
        assert "Traceback" not in err


# ---------------------------------------------------------------------------
# 10. A translate-only plugin loads; a broken one gets ONE clear error
# ---------------------------------------------------------------------------

from mt_eval_harness.method_loader import MethodLoadError, load_method


class TestTranslateOnlyPluginLoads:
    """The Agent Guide's minimal plugin (only `translate`) crashed with a raw
    AttributeError on `name`, then again on `method_card()`."""

    def test_defaults_come_from_method_json(self, tmp_path):
        m = load_method(_plugin_dir(tmp_path, method_id="upper-words"))
        assert m.name == "Upper words"
        card = m.method_card()
        assert card == {"method_id": "upper-words", "name": "Upper words",
                        "class": "custom-plugin", "paradigm": "unknown"}
        assert m.harness_defaulted == ["name", "method_card"]
        res = asyncio.run(m.translate([{"id": 0, "source": "hi"}], None))
        assert res[0]["predicted"] == "HI"

    def test_method_json_card_fields_are_used(self, tmp_path):
        m = load_method(_plugin_dir(
            tmp_path, method_id="up", version="1.2.0", author="X",
            **{"class": "pipeline", "paradigm": "rule-based"}))
        card = m.method_card()
        assert card["class"] == "pipeline" and card["paradigm"] == "rule-based"
        assert card["version"] == "1.2.0" and "entry_point" not in card

    def test_method_id_defaults_to_the_directory(self, tmp_path):
        m = load_method(_plugin_dir(tmp_path, name="my-plug"))
        assert m.method_card()["method_id"] == "my-plug"

    def test_a_full_plugin_is_returned_untouched(self, tmp_path):
        src = TRANSLATE_ONLY.replace(
            "class Upper:",
            "class Upper:\n    name = 'Own'\n"
            "    def method_card(self):\n"
            "        return {'method_id': 'own', 'name': 'Own', 'class': 'api'}\n")
        m = load_method(_plugin_dir(tmp_path, src=src))
        assert type(m).__name__ == "Upper" and m.name == "Own"

    def test_every_problem_in_one_error(self, tmp_path):
        src = "class Upper:\n    name = 3\n    method_card = 'x'\n"
        with pytest.raises(MethodLoadError) as exc:
            load_method(_plugin_dir(tmp_path, src=src))
        msg = str(exc.value)
        assert "translate — missing" in msg
        assert "name — present but not a non-empty string" in msg
        assert "method_card — present but not callable" in msg
        assert "Contract:" in msg

    def test_off_taxonomy_class_is_refused_at_load(self, tmp_path):
        with pytest.raises(MethodLoadError, match="Invalid class 'machine-translation-api'"):
            load_method(_plugin_dir(tmp_path, method_id="up",
                                    **{"class": "machine-translation-api"}))
        src = TRANSLATE_ONLY.replace(
            "class Upper:",
            "class Upper:\n    def method_card(self):\n"
            "        return {'class': 'llm-ish'}\n")
        with pytest.raises(MethodLoadError, match="Invalid class 'llm-ish'"):
            load_method(_plugin_dir(tmp_path, src=src, name="p2"))

    def test_own_card_is_held_only_to_the_vocabulary(self, tmp_path):
        # A plugin's own card without class/method_id loaded before and still
        # does — the spec promises only the class/paradigm vocabulary check.
        src = TRANSLATE_ONLY.replace(
            "class Upper:",
            "class Upper:\n    name = 'Own'\n"
            "    def method_card(self):\n        return {'name': 'Own'}\n")
        assert load_method(_plugin_dir(tmp_path, src=src)).method_card() == {"name": "Own"}

    def test_bad_default_method_id_says_how_to_fix(self, tmp_path):
        with pytest.raises(MethodLoadError, match="kebab-case"):
            load_method(_plugin_dir(tmp_path, name="My_Plugin"))

    def test_runs_end_to_end_and_says_what_was_defaulted(self, tmp_path, capsys):
        log, _report = _plugin_run(tmp_path, _plugin_dir(tmp_path, method_id="up"))
        out = capsys.readouterr().out
        assert "taken from method.json" in out
        assert log["provenance"]["method_card"]["class"] == "custom-plugin"

    def test_guide_and_spec_state_the_same_contract(self):
        root = Path(__file__).resolve().parents[2] / "cli" / "website" / "docs" / "network"
        if not root.is_dir():
            pytest.skip("monorepo docs not present")
        spec = (root / "specifications" / "methods.md").read_text()
        guide = (root / "getting-started" / "agent-guide.md").read_text()
        assert "will crash at load time" not in spec
        assert "only `translate` is required" in spec
        assert "`translate` is the only member the class needs" in guide
