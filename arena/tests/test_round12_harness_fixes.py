"""Round 12 synthetic personas (researcher eng→sme, Cree school eng→crk,
hospital qaa), 2026-10-04 — harness fixes.

 1. A near-constant output (one valid sentence for 29 of 30 inputs) scored a
    card composite of 0.5073 with no caveat: the ``near_constant_output``
    score caveat, by distinct sources and output length, with correct
    repeats left out; shown wherever the other caveats are; counts only.
 2. An S-class plugin with ``dependencies: []`` was cost "unknown" on every
    surface: an S/O plugin with no gateway/external-api dependency is
    "$0 API cost (runs on this machine)", and the report fields agree.
 3. compare said when the published composite and the tested
    segment_composite put different runs ahead — superseded by scoring
    standard/1: the composite is retired and chrF++ alone decides.
 4. compare's default file is unique to the runs compared; "replaced the
    previous one" only for an explicit -o.
 5. contest prepare prints every registration term as given/default with
    when it freezes; --help names the defaults.
 6. A hypotheses file's header shows no LLM settings.
12. The run header withholds a protected corpus's coaching first line.
18. Latency: "—" with why when nothing was timed; never 0.00 for 3.4 ms.
19. The publish preview of a local-only corpus says which of its facts go
    public and which stay here.
"""

from __future__ import annotations

import asyncio
import contextlib
import io
import json
from pathlib import Path

import pytest

from mt_eval_harness import score_caveats as sc
from mt_eval_harness.config import RunConfig


def _quiet(fn, *a, **kw):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        result = fn(*a, **kw)
    return result, buf.getvalue()


# Synthetic stand-ins (no corpus text): distinct English-like sources, a
# Sami-like constant output, distinct references.
CONSTANT = "Mun in dieđe"


def _entries(n=30, constant_for=29, other=None):
    """``constant_for`` rows get CONSTANT; the rest ``other`` (the toy's
    second sentence) or, when None, a different output each."""
    return [{"id": str(i), "source": f"Synthetic source sentence {i}.",
             "expected": f"Referánsa {i} cealkka.",
             "predicted": (CONSTANT if i < constant_for
                           else other or f"Iešguđet jorgalus nr {i}"),
             "length_ratio": 0.8} for i in range(n)]


# ===========================================================================
# 1. near-constant output
# ===========================================================================

class TestNearConstantOutput:
    def test_the_toy_is_flagged_major_with_counts_only(self):
        st = sc.near_constant_outputs(_entries())
        assert st["flagged"] is True
        assert st["considered_sources"] == 30
        assert st["repeated_sources"] == 29
        assert st["top_output_sources"] == 29 and st["top_output_words"] == 3
        cav = sc.near_constant_caveat(st)
        assert cav["kind"] == sc.NEAR_CONSTANT and cav["severity"] == "major"
        assert "29 of 30 distinct sources (97%)" in cav["message"]
        assert len(cav["message"]) <= sc.MESSAGE_CAP
        # never the output text: a published card carries this
        assert CONSTANT not in json.dumps(cav, ensure_ascii=False)
        assert sc.short_label(cav) == "97% near-constant output"

    def test_names_the_reference_free_metrics_it_rewards(self):
        overall = {"plugin_metrics": {
            "giellalt_fst_validity": {"avg_fst_validity": 0.66},
            "code_switching": {"avg_code_switching_rate": 0.0}}}
        found = sc.collect({"entries": _entries(), "overall": overall})
        nc = [c for c in found if c["kind"] == sc.NEAR_CONSTANT]
        assert nc and "FST acceptance and code-switching" in nc[0]["message"]
        assert nc[0]["emitted_only_metrics"] == ["FST acceptance",
                                                 "code-switching"]

    def test_an_output_equal_to_its_reference_is_not_a_repeat(self):
        rows = [{"id": str(i), "source": f"Yes variant {i}",
                 "expected": "Juo.", "predicted": "Juo."} for i in range(10)]
        st = sc.near_constant_outputs(rows)
        assert st["correct_repeats_excluded"] == 10
        assert st["repeated_sources"] == 0 and st["flagged"] is False

    def test_a_short_answer_needs_more_sources(self):
        """A 1–2-word output repeats legitimately: 4 sources is not a repeat
        (5 are needed); a 3+-word output repeats at 3."""
        def rows(out, k, n=12):
            return [{"id": str(i), "source": f"source {i}",
                     "expected": f"ref {i}",
                     "predicted": out if i < k else f"distinct output {i}"}
                    for i in range(n)]
        assert sc.near_constant_outputs(rows("Juo.", 4))["repeated_sources"] == 0
        assert sc.near_constant_outputs(rows("Juo.", 5))["repeated_sources"] == 5
        assert sc.near_constant_outputs(
            rows("Mun in dieđe", 3))["repeated_sources"] == 3

    def test_a_small_share_and_a_tiny_set_are_not_flagged(self):
        # 3 of 30 share one sentence: 10% < the quarter bound
        st = sc.near_constant_outputs(_entries(30, constant_for=3))
        assert st["repeated_sources"] == 3 and st["flagged"] is False
        # 3 of 6: half the set, but fewer than NEAR_CONSTANT_MIN_REPEATS
        st = sc.near_constant_outputs(_entries(6, constant_for=3))
        assert st["repeat_share"] == 0.5 and st["flagged"] is False

    def test_a_source_listed_twice_is_one_source(self):
        rows = [{"id": str(i), "source": "The same sentence.",
                 "expected": "x", "predicted": "Seammá cealkka dás."}
                for i in range(8)]
        st = sc.near_constant_outputs(rows)
        assert st["considered_sources"] == 1 and st["flagged"] is False

    def test_diacritics_tell_outputs_apart(self):
        from mt_eval_harness.text_compare import repeat_compare_key
        assert repeat_compare_key("ma") != repeat_compare_key("mà")
        assert repeat_compare_key("Mun in dieđe.") == repeat_compare_key(
            "mun  in dieđe")

    def test_two_alternating_constants_are_caught_too(self):
        rows = [{"id": str(i), "source": f"source {i}", "expected": f"r {i}",
                 "predicted": ("Mun in dieđe" if i % 2 else "Ollu giitu dutnje")}
                for i in range(20)]
        st = sc.near_constant_outputs(rows)
        assert st["repeated_outputs"] == 2 and st["flagged"] is True

    def test_compare_shows_it_beside_the_others(self, tmp_path):
        from mt_eval_harness.compare import compare_reports, format_comparison_table
        reports = []
        for name, rows in (("toy", _entries()),
                           ("ok", _entries(30, constant_for=0))):
            p = tmp_path / f"{name}_report.json"
            p.write_text(json.dumps({"run_id": name, "config": {},
                                     "overall": {"evaluated": 30},
                                     "entries": rows}))
            reports.append(p)
        comp = compare_reports([str(p) for p in reports])
        table = format_comparison_table(comp["overall_comparison"])
        assert "97% near-constant output" in table
        assert "near-constant" not in json.dumps(
            comp["overall_comparison"][1]["score_caveats"])

    def test_the_published_card_carries_it(self, tmp_path, monkeypatch):
        from mt_eval_harness import publish
        from test_publish import _write_pair_with_provenance
        monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)
        report = _write_pair_with_provenance(tmp_path, "nc", {})
        data = json.loads(report.read_text())
        data["entries"] = _entries()
        report.write_text(json.dumps(data))
        card, _, _ = publish.assemble_run_card(report)
        kinds = [c["kind"] for c in card.get("score_caveats") or []]
        assert sc.NEAR_CONSTANT in kinds
        assert CONSTANT not in json.dumps(card["score_caveats"],
                                          ensure_ascii=False)

    def test_the_measurement_script_uses_the_shipped_rule(self):
        script = (Path(__file__).resolve().parents[1] / "scripts"
                  / "verify_near_constant_caveat.py").read_text()
        assert "from mt_eval_harness.score_caveats import near_constant_outputs" in script


# ===========================================================================
# 2. an S/O plugin with no API dependency costs $0 API
# ===========================================================================

class TestSelfContainedPluginCost:
    @pytest.mark.parametrize("record,expected", [
        ({"dependency_class": "S", "dependencies": []}, True),
        ({"dependency_class": "O", "dependencies": [
            {"id": "fst", "access": "mirrored"}]}, True),
        ({"dependency_class": "S"}, False),                      # no list
        ({"dependency_class": "A1", "dependencies": []}, False),
        ({"dependency_class": "O", "dependencies": [
            {"id": "llm", "access": "gateway"}]}, False),         # contradicted
        ({"dependency_class": "S", "dependencies": [
            {"id": "dict", "access": "external-api"}]}, False),
        ({"dependencies": []}, False),                           # no class
        (None, False),
    ])
    def test_the_rule(self, record, expected):
        from mt_eval_harness.method_loader import plugin_calls_no_api
        assert plugin_calls_no_api(record) is expected

    def test_cost_label_and_estimate(self):
        from mt_eval_harness.run_card import cost_estimate_label, cost_label
        cfg = {"method_path": "/p", "provider": "openrouter"}
        s_plugin = {"method_plugin": {"dependency_class": "S",
                                      "dependencies": []}}
        assert cost_label(None, cfg, s_plugin) == \
            "$0 API cost (runs on this machine)"
        assert cost_label(None, cfg, {"method_plugin": {
            "dependency_class": "A1", "dependencies": []}}) == \
            "unknown (plugin prices its own calls)"
        est = cost_estimate_label(None, "method plugin, dependency class S",
                                  cfg, s_plugin)
        assert est.startswith("$0 API cost (runs on this machine) — "
                              "method plugin, dependency class S")

    def test_a_report_read_without_its_run_log(self):
        from mt_eval_harness.run_card import run_cost_label
        report = {"config": {"method_path": "/p"},
                  "method_plugin": {"dependency_class": "S",
                                    "dependencies": []},
                  "overall": {}, "entries": [{"cost_usd": None}]}
        assert run_cost_label(None, report) == \
            "$0 API cost (runs on this machine)"

    def test_a_run_records_it_everywhere(self, tmp_path):
        from mt_eval_harness.publish import assemble_run_card
        from mt_eval_harness.runner import execute_run
        plug = tmp_path / "copyplug"
        plug.mkdir()
        (plug / "method.json").write_text(json.dumps({
            "name": "Copy", "method_id": "copy-s", "class": "custom-plugin",
            "entry_point": "copy_m:CopyMethod", "version": "0.1.0",
            "dependency_class": "S", "dependencies": []}))
        (plug / "copy_m.py").write_text(
            "class CopyMethod:\n"
            "    async def translate(self, entries, config):\n"
            "        return [{'id': e['id'], 'predicted': e['source'],\n"
            "                 'latency_s': 0.0, 'usage': {}, 'error': None,\n"
            "                 'tool_calls': [], 'tool_call_count': 0,\n"
            "                 'metadata': {}} for e in entries]\n")
        corpus = tmp_path / "c.json"
        corpus.write_text(json.dumps({
            "dataset": {"language_pair": {"source": "eng", "target": "fra"},
                        "license": "CC-BY-4.0"},
            "entries": [{"id": str(i), "source": f"hello {i}",
                         "reference": f"bonjour {i}"} for i in range(4)]}))
        cfg = RunConfig(method_path=str(plug), corpus_path=str(corpus),
                        target_lang="French", output_dir=str(tmp_path / "out"),
                        cache_dir=str(tmp_path / "cache"), dataset="all",
                        skip_fst=True, skip_eval_standard=True)
        _, out = _quiet(lambda: asyncio.run(execute_run(cfg)))
        assert "Est. cost:   $0 API cost (runs on this machine) — method " \
               "plugin, dependency class S (self-contained)" in out
        report_path = next((tmp_path / "out").glob("*_report.json"))
        overall = json.loads(report_path.read_text())["overall"]
        assert overall["cost_label"] == "$0 API cost (runs on this machine)"
        assert overall["cost_unknown"] is False
        assert overall["api_cost_usd"] == 0.0
        card, _, _ = assemble_run_card(report_path)
        assert card["totals"]["cost_label"] == \
            "$0 API cost (runs on this machine)"
        # 18: the harness timed the call the plugin reported 0.0 for
        entries = json.loads(report_path.read_text())["entries"]
        assert all(e["latency_s"] > 0 for e in entries)


# ===========================================================================
# 3. the two composites point different ways — SUPERSEDED by scoring
#    standard/1 (2026-10-04): the composite is retired, so compare has ONE
#    decision, on chrF++, and nothing for two composites to disagree about.
# ===========================================================================

def _comparison(pub_a, pub_b, seg_delta, significant=True, *, legacy=True):
    """A comparison JSON as an OLD compare wrote it: published composites
    on the rows, a segment_composite test, and a chrF++ test."""
    seg = {"metric_name": "segment_composite", "system_a_score": 0.07,
           "system_b_score": 0.07 - seg_delta, "delta": seg_delta,
           "p_value": 0.001 if significant else 0.4, "n_bootstrap": 1000,
           "confidence_level": 0.95, "significant": significant,
           "winner": None, "ci_lower": seg_delta - 0.01,
           "ci_upper": seg_delta + 0.01, "method": "approximate_randomization",
           "direction": "higher"}
    chrf = dict(seg, metric_name="corpus_chrf", system_a_score=40.0,
                system_b_score=43.5, delta=-3.5, p_value=0.002,
                significant=True, ci_lower=-5.0, ci_upper=-2.0)
    rows = [{"run_id": "run-a", "composite": pub_a},
            {"run_id": "run-b", "composite": pub_b}]
    if legacy:
        for r in rows:
            r["legacy_composite_not_compared"] = True
    return {"overall_comparison": rows, "significance": [chrf, seg]}


class TestCompositeDirections:
    def test_composite_directions_are_gone(self):
        import mt_eval_harness.compare as compare
        assert not hasattr(compare, "composite_directions")
        assert not hasattr(compare, "composite_disagreement_lines")

    def test_an_old_comparison_decides_on_chrf_only(self):
        from mt_eval_harness.compare import (
            comparison_decision, format_comparison_significance)
        # The old published composites put A ahead (0.2351 vs 0.2307) and
        # the segment composite B: neither decides now — chrF++ does.
        comp = _comparison(0.2351, 0.2307, -0.1015)
        d = comparison_decision(comp)
        assert d["metric"] == "chrf_plus_plus" and d["tested"] is True
        assert [p["better"] for p in d["pairs"]] == ["B"]
        assert d["pairs"][0]["verdict"].startswith(
            "B is better than A on chrF++ (+3.5, p=0.002")
        text = format_comparison_significance(comp)
        assert "point opposite ways" not in text
        flat = " ".join(text.split())
        assert "Verdict: B is better than A on chrF++" in flat
        # The legacy rows are said once to carry a retired composite.
        assert flat.count("legacy composite (retired)") == 0  # said by the run table
        assert "segment_composite (segment-level; legacy, retired)" in text

    def test_a_legacy_report_is_said_once_in_the_run_table(self):
        from mt_eval_harness.compare import format_comparison_table
        comp = _comparison(0.30, 0.20, 0.05, False)
        table = format_comparison_table(comp["overall_comparison"])
        flat = " ".join(table.split())
        assert flat.count("legacy composite (retired)") == 1
        assert "A, B were scored before scoring standard/1" in flat
        assert "0.3000" not in table and "Composite" not in table


# ===========================================================================
# 4. compare's default file is unique to the runs compared
# ===========================================================================

def _report(path: Path, run_id: str):
    path.write_text(json.dumps({
        "run_id": run_id, "config": {}, "overall": {"evaluated": 1},
        "entries": [{"id": "1", "source": "a", "expected": "b",
                     "predicted": "b"}]}))
    return path


class TestComparisonFileName:
    def test_unique_per_runs_and_order(self, tmp_path):
        from mt_eval_harness.compare import comparison_filename
        a, b, c = (_report(tmp_path / f"{n}_report.json", f"run-{n}")
                   for n in "abc")
        ab = comparison_filename([a, b])
        assert ab.startswith("comparison-") and ab.endswith(".json")
        assert ab == comparison_filename([a, b])
        assert ab != comparison_filename([a, c])
        assert ab != comparison_filename([b, a])

    def test_two_compares_in_one_folder_both_survive(self, tmp_path):
        from mt_eval_harness.compare import run_compare
        a, b, c = (_report(tmp_path / f"{n}_report.json", f"run-{n}")
                   for n in "abc")
        _, out1 = _quiet(run_compare, [str(a), str(b)])
        _, out2 = _quiet(run_compare, [str(a), str(c)])
        files = sorted(tmp_path.glob("comparison-*.json"))
        assert len(files) == 2
        assert "replaced the previous one" not in out1 + out2
        # the same runs again rewrite their own file, without the notice
        _, out3 = _quiet(run_compare, [str(a), str(b)])
        assert len(sorted(tmp_path.glob("comparison-*.json"))) == 2
        assert "replaced the previous one" not in out3

    def test_an_explicit_o_still_says_it_replaced(self, tmp_path):
        from mt_eval_harness.compare import run_compare
        a, b = (_report(tmp_path / f"{n}_report.json", f"run-{n}")
                for n in "ab")
        target = tmp_path / "mine.json"
        _quiet(run_compare, [str(a), str(b)], str(target))
        _, out = _quiet(run_compare, [str(a), str(b)], str(target))
        assert "replaced the previous one" in out


# ===========================================================================
# 5. contest prepare: every term, given or default, and when it freezes
# ===========================================================================

class TestContestTerms:
    def test_prepare_flags_are_unset_until_given(self):
        from mt_eval_harness.cli import build_parser
        a = build_parser().parse_args([
            "contest", "prepare", "--corpus", "m.json", "--slug", "s",
            "--name", "N", "--pair", "qaa>qab", "--dev-size", "4",
            "--secret-size", "6", "--seed", "7",
            "--qualifier-threshold", "35", "--out", "o"])
        assert a.visibility is None and a.use_context is None
        assert a.primary_metric is None and a.results_visibility is None
        assert a.description is None

    def test_help_names_the_defaults_and_the_freezes(self):
        from mt_eval_harness.cli import build_parser
        parser = build_parser()
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf), pytest.raises(SystemExit):
            parser.parse_args(["contest", "prepare", "--help"])
        text = " ".join(buf.getvalue().split())
        assert "Default: public" in text
        assert "Default: non-commercial" in text
        assert "FIXED AT REGISTRATION" in text
        assert "Default: off" in text            # --anonymize-until-close

    def test_the_lines(self):
        from mt_eval_harness.contest_prep import (
            REGISTRATION_DEFAULTS, registration_term_lines)
        block = dict(REGISTRATION_DEFAULTS)
        text = " ".join(" ".join(registration_term_lines(
            block, {"results_visibility"}, registered=False)).split())
        assert "use_context non-commercial (default) — fixed at registration" in text
        assert "visibility public (default) — not frozen" in text
        assert "results_visibility hidden_until_close (given) — a promise: " \
               "frozen once the contest has its first entry" in text
        assert "may still change them; nothing is registered yet" in text


# ===========================================================================
# 6. a hypotheses file: no LLM settings in the header
# ===========================================================================

class TestHypothesesHeader:
    def test_only_what_applies(self):
        from mt_eval_harness.run_card import (
            EXTERNAL_OUTPUTS_NA, llm_settings_apply, prompt_label,
            run_settings_rows)
        cfg = {"provider": "external", "prompt_version": "hypotheses-submission",
               "temperature": 0.0, "batch_size": 25, "max_tokens": 32768}
        assert llm_settings_apply(cfg) is False
        assert prompt_label(cfg) == "n/a (outputs made outside the harness)"
        rows = run_settings_rows(cfg)
        assert rows == [("Outputs", EXTERNAL_OUTPUTS_NA)]
        flat = json.dumps(rows)
        for absent in ("Temperature", "Max tokens", "Batch size",
                       "hypotheses-submission"):
            assert absent not in flat


# ===========================================================================
# 12. a protected corpus's coaching first line stays out of the run header
# ===========================================================================

class TestCoachingLineWithheld:
    def test_withheld_with_the_reason(self):
        from mt_eval_harness.prompt_plan import (
            COACHING_LINE_WITHHELD, prompt_plan_lines)
        plan = {"kind": "coaching", "coaching_file": "/x/coaching.md",
                "first_line": "You are translating school notes",
                "chars": 900, "sha256": "ab" * 32,
                "builtin": "Translate into Plains Cree.",
                "names_target": True}
        shown = " ".join(prompt_plan_lines(plan))
        assert "You are translating school notes" in shown
        hidden = " ".join(prompt_plan_lines(plan, show_coaching_line=False))
        assert "You are translating school notes" not in hidden
        assert COACHING_LINE_WITHHELD in hidden

    def test_the_runner_passes_the_protection(self):
        src = (Path(__file__).resolve().parents[1] / "mt_eval_harness"
               / "runner.py").read_text()
        assert src.count("show_coaching_line=not _cache_protection") == 2


# ===========================================================================
# 18. latency: recorded or not, with the precision it needs
# ===========================================================================

class TestLatency:
    def test_reading(self):
        from mt_eval_harness.run_card import latency_reading, latency_text
        timed = {"overall": {"avg_latency_s": 0.0034},
                 "entries": [{"latency_s": 0.0034}] * 3}
        assert latency_reading(timed) == {"recorded": 3, "avg": 0.0034,
                                          "why": None}
        assert latency_text(0.0034) == "0.0034"
        assert latency_text(1.234) == "1.23"
        assert latency_text(0.00001) == "<0.0001"
        cached = {"entries": [{"latency_s": 0.0, "cached": True}] * 2}
        assert "served from the cache" in latency_reading(cached)["why"]
        ext = {"config": {"provider": "external"},
               "entries": [{"latency_s": 0.0}]}
        assert "outside the harness" in latency_reading(ext)["why"]
        plug = {"config": {"method_path": "/p"},
                "entries": [{"latency_s": 0.0}]}
        assert "method reported no time" in latency_reading(plug)["why"]

    def test_compare_shows_a_dash_and_why(self, tmp_path):
        from mt_eval_harness.compare import compare_reports, format_comparison_table
        a = tmp_path / "a_report.json"
        a.write_text(json.dumps({
            "run_id": "forge", "config": {"mt_method": "nmt-forge"},
            "overall": {"evaluated": 2, "avg_latency_s": 0.0034},
            "entries": [{"id": "1", "latency_s": 0.0034},
                        {"id": "2", "latency_s": 0.0034}]}))
        b = tmp_path / "b_report.json"
        b.write_text(json.dumps({
            "run_id": "hyps", "config": {"provider": "external"},
            "overall": {"evaluated": 2, "avg_latency_s": 0.0},
            "entries": [{"id": "1", "latency_s": 0.0},
                        {"id": "2", "latency_s": 0.0}]}))
        comp = compare_reports([str(a), str(b)])
        table = format_comparison_table(comp["overall_comparison"])
        row = next(l for l in table.splitlines() if "Avg latency" in l)
        assert "0.0034" in row and "—" in row and "0.00 " not in row + " "
        assert "Avg latency — = not recorded: B the outputs were made " \
               "outside the harness" in " ".join(table.split())

    def test_method_strategy_times_the_call(self):
        from mt_eval_harness.strategies.method_strategy import _fill_latency
        results = [{"id": "1", "latency_s": 0.0}, {"id": "2"},
                   {"id": "3", "latency_s": 0.5}]
        _fill_latency(results, 0.003, 3)
        assert results[0]["latency_s"] == 0.001
        assert results[1]["latency_s"] == 0.001
        assert results[2]["latency_s"] == 0.5          # the method's own
        assert "harness" in results[0]["metadata"]["latency_source"]

    def test_a_fast_batch_is_not_rounded_to_zero(self):
        src = (Path(__file__).resolve().parents[1] / "mt_eval_harness"
               / "strategies" / "batch.py").read_text()
        assert 'round(result["latency_s"] / n, 3)' not in src
        assert 'round(result["latency_s"] / n, 6)' in src


# ===========================================================================
# 19. a local-only corpus: what goes public, what stays here
# ===========================================================================

class TestLocalOnlyPublication:
    def test_the_statement(self, tmp_path, monkeypatch, capsys):
        from mt_eval_harness import publish
        from test_publish import _write_pair_with_provenance
        monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)
        monkeypatch.setattr(publish, "_is_prod_target", lambda: False)
        report = _write_pair_with_provenance(tmp_path, "lo", {
            "dataset_meta": {"transmission": "local-only",
                             "license": "LicenseRef-Ward-Own"}})
        card, _, _ = publish.assemble_run_card(report)
        info = publish.local_only_publication(card, json.loads(
            report.read_text()))
        joined = " ".join(info["published"])
        assert f"its id {card['dataset']['id']!r}" in joined
        assert "its licence LicenseRef-Ward-Own" in joined
        assert "sha256" in joined and "marked local-only" in joined
        assert any("every sentence" in w for w in info["withheld"])
        assert "cannot open" in info["reading"]
        publish.publish_to_supabase(str(report), dry_run=True,
                                    auto_confirm=True)
        out = " ".join(capsys.readouterr().out.split())
        assert "Local-only corpus — what this publish makes public" in out
        assert "Published with the score (metadata, no text):" in out
        assert "Stays on this machine:" in out
        assert "How others read it:" in out

    def test_an_ordinary_corpus_gets_no_block(self, tmp_path, monkeypatch,
                                              capsys):
        from mt_eval_harness import publish
        from test_publish import _write_pair_with_provenance
        monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)
        monkeypatch.setattr(publish, "_is_prod_target", lambda: False)
        report = _write_pair_with_provenance(tmp_path, "plain", {})
        publish.publish_to_supabase(str(report), dry_run=True,
                                    auto_confirm=True)
        assert "Local-only corpus" not in capsys.readouterr().out
