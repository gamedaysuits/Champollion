"""Round 3 synthetic users (hospital, researcher, school), 2026-10-03.

1. nmt-forge's near-twin caveat (every test row has a train-side twin: the
   score measures recall of training phrases) reached DEPLOY.md and the
   mt-eval files forge writes, but every harness surface showed chrF++ 100 /
   "Deterministic 1.0000 (fluent)" with no caveat.
2. Terminology adherence headlined "37.3%" / "91.9%" beside 0 of 127 / 0 of 7
   terms matched: term-free entries each counted as a perfect 1.0.
5. Outputs 2.5–4× the reference length (leaked few-shot examples) went
   unflagged.
7. The compare header did not show the prompt/condition that differed.
8. The publish dry-run said rows would go public without showing any.
9. comparison.json / run logs / reports / dashboards of a local-only corpus
   carried its sentences with no mark.
"""

from __future__ import annotations

import contextlib
import io
import json
import sys
from pathlib import Path

import pytest

from mt_eval_harness import publish, score_caveats
from mt_eval_harness.compare import compare_reports, format_comparison_table, run_compare
from mt_eval_harness.plugins.terminology import (
    TerminologyPlugin, adherence_label, corpus_adherence)
from mt_eval_harness.publish import assemble_run_card
from mt_eval_harness.run_card import render_run_card
from mt_eval_harness.tester import analyze_run_log

REPO = Path(__file__).resolve().parents[2]

NEAR_TWIN_ALL = {
    "checked": True, "n": 3, "near_twin_rows": 3, "near_twin_share": 1.0,
    "jaccard_threshold": 0.8, "strict_n": 0, "strict": None,
    "recall_not_translation": True,
    "message": ("all 3 test rows have a near-identical twin in the training "
                "data — there is no clean subset to score: this score "
                "measures recall of training phrases, not translation"),
}

ROWS = [
    ("Where does it hurt?", "Gos bávččas?"),
    ("Take this medicine twice a day.", "Váldde dán dálkkasa guktii beaivvis."),
    ("The doctor is coming.", "Doavttir boahtá."),
]


@pytest.fixture(autouse=True)
def _no_git(monkeypatch):
    monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)
    monkeypatch.setattr(publish, "_is_prod_target", lambda: False)


def _run_log(name: str, outputs: list[str], *, provenance: dict | None = None,
             config: dict | None = None) -> dict:
    results = [{"id": i, "source": s, "expected": r, "predicted": o,
                "raw_predicted": o, "latency_s": 0.1, "cost_usd": 0.0,
                "cached": False, "error": None}
               for i, ((s, r), o) in enumerate(zip(ROWS, outputs))]
    return {
        "run_id": name, "harness_version": "0.2.0",
        "timestamp_start": "2026-10-03T00:00:00Z", "elapsed_s": 1.0,
        "total_cost_usd": 0.0, "cache_hits": 0,
        "config": {"model": f"test/{name}", "prompt_version": "naive",
                   "temperature": 0.0, "batch_size": 1, "max_tokens": 256,
                   "dataset_id": "round3-test", "source_lang": "English",
                   "target_lang": "French", "provider": "local",
                   **(config or {})},
        "provenance": {"corpus_sha256": "c" * 64,
                       "system_prompt_sha256": "d" * 64,
                       "dataset_meta": {"version": "1"},
                       **(provenance or {})},
        "results": results,
    }


def _analyze(tmp_path: Path, run_log: dict, plugins=None) -> tuple[Path, dict, str]:
    """Write the run log, run the REAL tester, return (report path, report,
    printed summary)."""
    tmp_path.mkdir(parents=True, exist_ok=True)
    log_path = tmp_path / f"{run_log['run_id']}.json"
    log_path.write_text(json.dumps(run_log), encoding="utf-8")
    report_path = tmp_path / f"{run_log['run_id']}_report.json"
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        report = analyze_run_log(run_log, output_path=report_path,
                                 metric_plugins=plugins or [], compute_ci=False,
                                 source_log_path=str(log_path))
    return report_path, report, out.getvalue()


def _forge_run(tmp_path: Path, name: str = "forge") -> tuple[Path, dict, str]:
    """A forge-shaped run: outputs equal the references (chrF++ 100), the
    near-twin reading in the RunLog provenance AND the TestReport overall
    fields, exactly as forge's harness_bridge writes them."""
    log = _run_log(name, [r for _, r in ROWS],
                   provenance={"nmt_forge": {"set": "ward-test",
                                             "near_twin": NEAR_TWIN_ALL}})
    report_path, report, out = _analyze(tmp_path, log)
    from mt_eval_harness.score_caveats import NEAR_TWIN  # noqa: F401
    report["overall"].update(_forge_overall_fields(NEAR_TWIN_ALL))
    report_path.write_text(json.dumps(report), encoding="utf-8")
    return report_path, report, out


def _forge_overall_fields(nt: dict) -> dict:
    """forge's own writer when importable (the contract), else its shape."""
    try:
        sys.path.insert(0, str(REPO / "forge"))
        from nmt_forge.harness_bridge import overall_caveat_fields
        return overall_caveat_fields(nt)
    except Exception:  # forge not importable here — same field names
        return {"nmt_forge_near_twin_checked": nt["checked"],
                "nmt_forge_near_twin_rows": nt["near_twin_rows"],
                "nmt_forge_near_twin_share": nt["near_twin_share"],
                "nmt_forge_strict_n": nt["strict_n"],
                "nmt_forge_strict_corpus_chrf": None,
                "nmt_forge_strict_corpus_chrf_ci": None,
                "nmt_forge_recall_not_translation": nt["recall_not_translation"],
                "nmt_forge_score_caveat": nt["message"]}
    finally:
        if sys.path and sys.path[0] == str(REPO / "forge"):
            sys.path.pop(0)


# ---------------------------------------------------------------------------
# 1. nmt-forge near-twin caveat on every surface
# ---------------------------------------------------------------------------

class TestNearTwinCaveat:

    def test_collected_from_runlog_or_report_fields(self, tmp_path):
        _, report, _ = _forge_run(tmp_path)
        from_report = score_caveats.collect({"overall": report["overall"]})
        assert from_report and from_report[0]["kind"] == score_caveats.NEAR_TWIN
        assert from_report[0]["recall_not_translation"] is True
        assert from_report[0]["severity"] == "major"
        from_log = score_caveats.near_twin_caveat(
            None, {"provenance": {"nmt_forge": {"near_twin": NEAR_TWIN_ALL}}})
        assert from_log["near_twin_rows"] == 3 and from_log["n"] == 3

    def test_clean_reading_is_not_a_caveat(self):
        clean = dict(NEAR_TWIN_ALL, near_twin_rows=0, near_twin_share=0.0,
                     recall_not_translation=False,
                     message="no test row has a near-twin in the training data")
        assert score_caveats.near_twin_caveat(
            None, {"provenance": {"nmt_forge": {"near_twin": clean}}}) is None

    def test_unchecked_reading_is_a_minor_note(self):
        unchecked = {"checked": False, "n": 3, "near_twin_rows": None,
                     "recall_not_translation": False,
                     "message": "near-twin check not run (set "
                                "eval.near_dupe_corpus to the training file)"}
        c = score_caveats.near_twin_caveat(
            None, {"provenance": {"nmt_forge": {"near_twin": unchecked}}})
        assert c["severity"] == "minor"
        assert score_caveats.short_label(c) == "near-twin check not run"

    def test_test_summary_prints_it_under_the_headline(self, tmp_path):
        _, report, out = _forge_run(tmp_path)
        assert "SCORE CAVEAT (nmt-forge)" in out
        # Right under the chrF++ headline (scoring standard/1).
        assert out.index("Headline:") < out.index("SCORE CAVEAT")
        assert "recall of training phrases" in out
        assert report["score_caveats"][0]["kind"] == score_caveats.NEAR_TWIN

    def test_run_card_prints_it_above_the_scores(self, tmp_path):
        report_path, _, _ = _forge_run(tmp_path)
        card = render_run_card(tmp_path / "forge.json", report_path)
        assert "SCORE CAVEAT (nmt-forge)" in card
        assert card.index("SCORE CAVEAT") < card.index("chrF++ (corpus)")
        width = {len(line) for line in card.splitlines() if line.startswith("  │")}
        assert len(width) == 1, "the caveat must wrap inside the box"

    def test_compare_table_flags_the_run(self, tmp_path):
        a, _, _ = _forge_run(tmp_path / "a", "forge_a")
        b, _, _ = _analyze(tmp_path / "b", _run_log("plain_b",
                                                    [r for _, r in ROWS]))
        comparison = compare_reports([a, b])
        table = format_comparison_table(comparison["overall_comparison"])
        assert "⚠ Score caveat" in table and "recall, not translation" in table
        assert "A  ⚠ SCORE CAVEAT (nmt-forge)" in table
        assert comparison["overall_comparison"][0]["score_caveats"]
        assert not comparison["overall_comparison"][1]["score_caveats"]

    def test_published_card_carries_it_and_tier_is_unchanged(self, tmp_path):
        report_path, _, _ = _forge_run(tmp_path / "f")
        card, _, fp = assemble_run_card(report_path)
        caveats = card["score_caveats"]
        assert caveats[0]["kind"] == score_caveats.NEAR_TWIN
        assert caveats[0]["recall_not_translation"] is True
        # migration 051: strings inside array objects ≤ 500 chars
        assert all(len(v) <= 500 for c in caveats for v in c.values()
                   if isinstance(v, str))
        # the same run without the caveat: identical scores, tier, fingerprint
        plain, _, _ = _analyze(tmp_path / "p", _run_log("forge",
                                                        [r for _, r in ROWS]))
        card_plain, _, fp_plain = assemble_run_card(plain)
        assert "score_caveats" not in card_plain
        assert card["scores"]["composite"] == card_plain["scores"]["composite"]
        assert card["scores"]["quality_tier"] == card_plain["scores"]["quality_tier"]
        assert fp == fp_plain

    def test_publish_preview_states_it_beside_the_headline(self, tmp_path, capsys):
        report_path, _, _ = _forge_run(tmp_path)
        row = publish.publish_to_supabase(str(report_path), dry_run=True,
                                          auto_confirm=True)
        out = capsys.readouterr().out
        assert "SCORE CAVEAT (nmt-forge)" in out
        assert out.index("SCORE CAVEAT") < out.index("Headline:")
        lines = out.splitlines()
        head = next(i for i, l in enumerate(lines) if "Headline:" in l)
        beside = next(l for l in lines[head:head + 4] if "⚠ caveat:" in l)
        assert "recall, not translation" in beside
        # No composite, no tier on the preview (scoring standard/1).
        assert "Deterministic:" not in out and "quality tier:" not in out
        assert "Not shown: a composite or a quality tier." in out
        assert row["run_card"]["score_caveats"][0]["kind"] == score_caveats.NEAR_TWIN

    def test_dashboard_injects_it(self, tmp_path):
        from mt_eval_harness.dashboard import _load_one
        report_path, _, _ = _forge_run(tmp_path)
        assert _load_one(str(report_path))["score_caveats"][0]["source"] == "nmt-forge"


# ---------------------------------------------------------------------------
# 2. Terminology adherence = matched / total glossary-term occurrences
# ---------------------------------------------------------------------------

class TestTerminologyMatchesItsCounts:

    GLOSSARY = {"medicine": ["dálkkas"], "doctor": ["doavttir"],
                "nurse": ["buohccidikšu"]}

    def _agg(self, pairs):
        plugin = TerminologyPlugin(glossary=self.GLOSSARY)
        return plugin.aggregate([plugin.compute({"source": s, "predicted": p})
                                 for s, p in pairs])

    def test_nothing_matched_is_zero_not_a_mean_of_term_free_ones(self):
        # 2 entries carry terms (0 matched), 5 carry none — the old code
        # averaged 0, 0, 1, 1, 1, 1, 1 = 71.4%.
        pairs = [("Take this medicine.", "Take this medicine."),
                 ("The doctor and the nurse.", "The doctor and the nurse.")]
        pairs += [(f"Hello {i}.", f"Hello {i}.") for i in range(5)]
        agg = self._agg(pairs)
        assert agg["avg_terminology_adherence"] == 0.0
        assert agg["total_term_matches"] == 0 and agg["total_term_total"] == 3
        assert agg["entries_with_terms"] == 2 and agg["entries_without_terms"] == 5
        label = adherence_label(agg)
        assert label.startswith("0.0% (0 of 3 glossary terms matched")
        assert "5 entries without a glossary term excluded" in label

    def test_pooled_over_terms_not_averaged_over_entries(self):
        # entry A: 1 of 1; entry B: 1 of 2 → 2 of 3 = 0.6667 (not 0.75)
        agg = self._agg([("Take this medicine.", "Váldde dálkkas."),
                         ("The doctor and the nurse.", "Doavttir ja nurse.")])
        assert agg["avg_terminology_adherence"] == round(2 / 3, 4)

    def test_no_term_anywhere_is_none_and_says_why(self):
        agg = self._agg([("Hello.", "Bures.")])
        assert agg["avg_terminology_adherence"] is None
        assert "no glossary term occurs" in adherence_label(agg)
        assert adherence_label(TerminologyPlugin().aggregate(
            [TerminologyPlugin().compute({"source": "a", "predicted": "b"})])
        ) == "no glossary (inactive)"

    def test_publish_reads_the_counts_of_an_old_report(self):
        old = {"avg_terminology_adherence": 0.373, "total_term_matches": 0,
               "total_term_total": 127, "total_term_misses": 127}
        assert corpus_adherence(old) == 0.0
        assert corpus_adherence({"avg_terminology_adherence": 0.5}) == 0.5
        assert corpus_adherence({"error": "x"}) is None

    def test_card_and_composite_use_the_corrected_value(self, tmp_path):
        outputs = [s for s, _ in ROWS]           # an echo: no term matched
        plugin = TerminologyPlugin(glossary=self.GLOSSARY)
        report_path, report, out = _analyze(
            tmp_path, _run_log("echo", outputs), plugins=[plugin])
        assert "Terminology:      0.0% (0 of 2 glossary terms matched" in out
        card, _, _ = assemble_run_card(report_path)
        assert card["scores"]["terminology_adherence"] == 0.0
        rendered = render_run_card(tmp_path / "echo.json", report_path)
        assert "0 of 2 glossary terms matched" in rendered

    def test_lint_flags_a_value_that_contradicts_its_counts(self):
        sys.path.insert(0, str(REPO / "arena" / "scripts"))
        try:
            import lint_run_reports as lint
        finally:
            sys.path.pop(0)

        def findings(term):
            f = lint.Findings()
            lint.check_report("r", {"overall": {"plugin_metrics": {
                "terminology": term}}, "entries": []}, f)
            return [x["message"] for x in f.items
                    if "contradicts its own counts" in x["message"]]

        assert findings({"avg_terminology_adherence": 0.373,
                         "total_term_matches": 0, "total_term_total": 127})
        assert not findings({"avg_terminology_adherence": 0.0,
                             "total_term_matches": 0, "total_term_total": 127})


# ---------------------------------------------------------------------------
# 5. Length inflation
# ---------------------------------------------------------------------------

class TestLengthInflation:

    def test_inflated_outputs_warn_on_every_surface(self, tmp_path):
        outputs = [r + " Example: hello = bures. Example: thanks = giitu."
                   for _, r in ROWS]
        report_path, report, out = _analyze(tmp_path, _run_log("fewshot", outputs))
        stats = report["overall"]["length_inflation"]
        assert stats["flagged"] and stats["mean_ratio"] > 2.0
        assert "SCORE CAVEAT (mt-eval-harness)" in out and "inflation bound" in out
        assert "SCORE CAVEAT" in render_run_card(tmp_path / "fewshot.json",
                                                 report_path)
        card, _, _ = assemble_run_card(report_path)
        assert card["score_caveats"][0]["kind"] == score_caveats.LENGTH_INFLATION

    def test_bounds(self):
        ok = [{"expected": "x", "length_ratio": 1.2}] * 4
        assert not score_caveats.length_inflation(ok)["flagged"]
        quarter = ok[:3] + [{"expected": "x", "length_ratio": 3.0}]
        assert score_caveats.length_inflation(quarter)["flagged"]   # 25 %
        few = ok * 2 + [{"expected": "x", "length_ratio": 3.0}]
        assert not score_caveats.length_inflation(few)["flagged"]   # 11 %
        assert score_caveats.length_inflation([]) is None


# ---------------------------------------------------------------------------
# 7. compare header shows the condition that differs
# ---------------------------------------------------------------------------

def test_compare_header_shows_prompt_and_differing_settings(tmp_path):
    a, _, _ = _analyze(tmp_path / "a", _run_log("naive_a", [r for _, r in ROWS]))
    b, _, _ = _analyze(tmp_path / "b", _run_log(
        "coached_b", [r for _, r in ROWS],
        config={"coaching_file": "/x/coaching.json", "temperature": 0.7}))
    table = format_comparison_table(compare_reports([a, b])["overall_comparison"])
    line = next(l for l in table.splitlines() if "Prompt (condition)" in l)
    assert "naive" in line and "coached" in line
    assert "coaching.json" in table and "Temperature" in table
    assert "Batch size" not in table      # the same in both → not shown


# ---------------------------------------------------------------------------
# 8. publish dry-run shows the rows it would upload — only when publishable
# ---------------------------------------------------------------------------

class TestPublishPreviewRows:

    def test_rows_listed_when_text_is_publishable(self, tmp_path, capsys):
        report_path, _, _ = _analyze(tmp_path, _run_log("open", [r for _, r in ROWS]))
        publish.publish_to_supabase(str(report_path), dry_run=True,
                                    auto_confirm=True,
                                    publish_entries_override=True)
        out = capsys.readouterr().out
        assert "First 3 of 3 rows as they would be uploaded:" in out
        assert "source:    Where does it hurt?" in out
        assert "reference: Gos bávččas?" in out

    def test_never_for_a_local_only_corpus(self, tmp_path, capsys):
        report_path, _, _ = _analyze(tmp_path, _run_log(
            "lo", [r for _, r in ROWS],
            provenance={"dataset_meta": {"transmission": "local-only"}}))
        publish.publish_to_supabase(str(report_path), dry_run=True,
                                    auto_confirm=True,
                                    publish_entries_override=True)
        out = capsys.readouterr().out
        assert "rows as they would be uploaded" not in out
        assert "Where does it hurt?" not in out

    def test_preview_lines_cap_and_count(self):
        rows = [{"entry_id": str(i), "source": "s" * 200, "expected": "e",
                 "predicted": "p"} for i in range(5)]
        lines = publish._entry_preview_lines(rows)
        assert lines[0].strip() == "First 3 of 5 rows as they would be uploaded:"
        assert lines[-1].strip() == "… and 2 more"
        assert all(len(l) < 110 for l in lines)


# ---------------------------------------------------------------------------
# 9. files derived from a protected corpus carry its mark
# ---------------------------------------------------------------------------

class TestDerivedFilesAreMarked:

    PROV = {"dataset_meta": {"transmission": "local-only",
                             "license": "LicenseRef-School-Own"}}

    def test_runlog_report_comparison_and_dashboard_sidecars(self, tmp_path, capsys):
        from mt_eval_harness.corpus_loader import (
            marked_local_only, read_steward_sidecar)
        from mt_eval_harness.pipeline import write_run_log
        log = _run_log("school_a", [r for _, r in ROWS], provenance=self.PROV)
        log_path = write_run_log(log, str(tmp_path / "a"))
        side = read_steward_sidecar(log_path)
        assert side["transmission"] == "local-only"
        assert side["license"] == "LicenseRef-School-Own"
        assert side["written_by"] == "mt-eval run" and side["derived_from"]

        a, _, out = _analyze(tmp_path / "a2", log)
        assert "holds the corpus sentences and is marked" in out
        assert marked_local_only(a)

        b, _, _ = _analyze(tmp_path / "b", _run_log(
            "school_b", [s for s, _ in ROWS], provenance=self.PROV))
        out_path = tmp_path / "results" / "comparison.json"
        capsys.readouterr()
        run_compare([str(a), str(b)], output_path=str(out_path))
        printed = capsys.readouterr().out
        assert "Comparison written to:" in printed
        assert "comparison.json holds the corpus sentences and is marked" in printed
        comp_side = read_steward_sidecar(out_path)
        assert comp_side["transmission"] == "local-only"
        assert comp_side["written_by"] == "mt-eval compare"
        assert "school_a_report.json" in comp_side["derived_from"]

        from mt_eval_harness.dashboard import generate, load_reports
        html = tmp_path / "dash.html"
        generate(load_reports([str(a), str(b)]), str(html))
        assert read_steward_sidecar(html)["transmission"] == "local-only"

    def test_unprotected_runs_get_no_sidecar(self, tmp_path):
        from mt_eval_harness.pipeline import write_run_log
        log_path = write_run_log(_run_log("open", [r for _, r in ROWS]),
                                 str(tmp_path))
        assert not Path(str(log_path) + ".champollion.json").exists()
        a, _, _ = _analyze(tmp_path / "x", _run_log("open_x", [r for _, r in ROWS]))
        assert not Path(str(a) + ".champollion.json").exists()

    def test_sealed_and_consent_required_marks(self):
        from mt_eval_harness.corpus_loader import derived_mark
        sealed = {"config": {"transmission_policy": {"mode": "sealed"}},
                  "provenance": {"dataset_meta": {"segment": "held_out"}}}
        assert derived_mark(sealed) == {"segment": "held_out"}
        consent = {"config": {"transmission_policy": {
                       "mode": "consent-required"}},
                   "provenance": {"dataset_meta": {
                       "license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0"}}}
        assert derived_mark(consent) == {
            "license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0"}
        quarantined = {"config": {"transmission_policy": {"mode": "sealed"}}}
        assert derived_mark(quarantined) == {"transmission": "local-only"}
        assert derived_mark({"config": {"transmission_policy": {
            "mode": "no-train"}}}) == {}
