"""
Tests for mt_eval_harness.compare — multi-run comparison engine.

Covers:
    - Loading and comparing multiple TestReports
    - Overall comparison table construction
    - Per-entry regression/improvement detection
    - Edge cases (missing entries, single report, RunLog handling)
    - Plugin metric forwarding in comparison rows
"""

import json
import re
from pathlib import Path

import pytest

from mt_eval_harness.compare import compare_reports, run_compare


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def report_a(tmp_path):
    """First run — lower accuracy baseline."""
    report = {
        "run_id": "run_baseline",
        "config": {
            "model": "gemini-2.5-flash",
            "prompt_version": "naive",
            "tools_enabled": False,
            "batch_size": 1,
        },
        "overall": {
            "evaluated": 5,
            "exact_match_rate": 0.40,
            "corpus_chrf": 55.0,
            "total_cost_usd": 0.05,
            "avg_latency_s": 1.2,
        },
        "entries": [
            {"id": 0, "source": "Hello", "expected": "Bonjour", "predicted": "Bonjour", "exact_match": True},
            {"id": 1, "source": "Thanks", "expected": "Merci", "predicted": "Merci", "exact_match": True},
            {"id": 2, "source": "Dog", "expected": "Chien", "predicted": "Chat", "exact_match": False},
            {"id": 3, "source": "Cat", "expected": "Chat", "predicted": "Chien", "exact_match": False},
            {"id": 4, "source": "Sky", "expected": "Ciel", "predicted": "Ciel", "exact_match": True},
        ],
    }
    path = tmp_path / "report_a.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    return path, report


@pytest.fixture
def report_b(tmp_path):
    """Second run — improved accuracy, with one regression."""
    report = {
        "run_id": "run_coached",
        "config": {
            "model": "gemini-3.1-pro",
            "prompt_version": "coached",
            "tools_enabled": True,
            "batch_size": 1,
        },
        "overall": {
            "evaluated": 5,
            "exact_match_rate": 0.60,
            "corpus_chrf": 72.0,
            "total_cost_usd": 0.12,
            "avg_latency_s": 2.1,
        },
        "entries": [
            # id=0: was correct, still correct (stable)
            {"id": 0, "source": "Hello", "expected": "Bonjour", "predicted": "Bonjour", "exact_match": True},
            # id=1: was correct, now WRONG (regression!)
            {"id": 1, "source": "Thanks", "expected": "Merci", "predicted": "Gracias", "exact_match": False},
            # id=2: was wrong, now CORRECT (improvement!)
            {"id": 2, "source": "Dog", "expected": "Chien", "predicted": "Chien", "exact_match": True},
            # id=3: was wrong, now CORRECT (improvement!)
            {"id": 3, "source": "Cat", "expected": "Chat", "predicted": "Chat", "exact_match": True},
            # id=4: was correct, still correct (stable)
            {"id": 4, "source": "Sky", "expected": "Ciel", "predicted": "Ciel", "exact_match": True},
        ],
    }
    path = tmp_path / "report_b.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    return path, report


# ---------------------------------------------------------------------------
# compare_reports() — core comparison logic
# ---------------------------------------------------------------------------

class TestCompareReports:
    """Tests for the comparison engine itself (from loaded dicts)."""

    def test_basic_comparison(self, report_a, report_b):
        """Two valid reports produce a valid comparison structure."""
        result = compare_reports([report_a[0], report_b[0]])

        assert result["run_count"] == 2
        assert len(result["overall_comparison"]) == 2
        assert "regressions" in result
        assert "improvements" in result

    def test_overall_rows_match_reports(self, report_a, report_b):
        """Each report becomes a row in the overall comparison table."""
        result = compare_reports([report_a[0], report_b[0]])
        rows = result["overall_comparison"]

        assert rows[0]["run_id"] == "run_baseline"
        assert rows[0]["model"] == "gemini-2.5-flash"
        assert rows[0]["exact_match"] == 0.40

        assert rows[1]["run_id"] == "run_coached"
        assert rows[1]["model"] == "gemini-3.1-pro"
        assert rows[1]["exact_match"] == 0.60

    def test_regression_detected(self, report_a, report_b):
        """Entry id=1 was correct in A, wrong in B → regression."""
        result = compare_reports([report_a[0], report_b[0]])

        assert result["regression_count"] == 1
        reg = result["regressions"][0]
        assert reg["id"] == 1
        assert reg["source"] == "Thanks"
        assert reg["first_predicted"] == "Merci"
        assert reg["last_predicted"] == "Gracias"

    def test_improvements_detected(self, report_a, report_b):
        """Entries id=2,3 were wrong in A, correct in B → improvements."""
        result = compare_reports([report_a[0], report_b[0]])

        assert result["improvement_count"] == 2
        imp_ids = {i["id"] for i in result["improvements"]}
        assert imp_ids == {2, 3}

    def test_stable_entries_not_flagged(self, report_a, report_b):
        """Entries that didn't change status (0, 4) aren't flagged."""
        result = compare_reports([report_a[0], report_b[0]])

        all_flagged_ids = {
            e["id"] for e in result["regressions"] + result["improvements"]
        }
        # id=0 and id=4 should NOT appear
        assert 0 not in all_flagged_ids
        assert 4 not in all_flagged_ids

    def test_insufficient_reports(self):
        """Fewer than 2 reports returns an error dict."""
        result = compare_reports([])
        assert "error" in result

    def test_single_report_insufficient(self, report_a):
        """A single report isn't enough for comparison."""
        result = compare_reports([report_a[0]])
        assert "error" in result

    def test_missing_file_skipped(self, tmp_path, report_a):
        """Non-existent file paths are skipped with a warning."""
        fake = tmp_path / "nonexistent.json"
        result = compare_reports([report_a[0], fake])
        assert "error" in result  # Only 1 valid report → insufficient

    def test_plugin_metrics_forwarded(self, tmp_path, report_a, report_b):
        """Plugin aggregate metrics appear in comparison rows."""
        # Modify report_a to include plugin metrics
        _, data = report_a
        data["overall"]["plugin_metrics"] = {
            "morphology": {"avg_validity_rate": 0.75}
        }
        path = tmp_path / "report_a_with_plugins.json"
        path.write_text(json.dumps(data), encoding="utf-8")

        result = compare_reports([path, report_b[0]])
        row_a = result["overall_comparison"][0]
        assert row_a["morphology.avg_validity_rate"] == 0.75

    def test_tools_flag_captured(self, report_a, report_b):
        """tools_enabled flag is captured in comparison rows."""
        result = compare_reports([report_a[0], report_b[0]])
        rows = result["overall_comparison"]
        assert rows[0]["tools"] is False
        assert rows[1]["tools"] is True


# ---------------------------------------------------------------------------
# run_compare() — CLI entry point
# ---------------------------------------------------------------------------

class TestRunCompare:
    """Tests for the CLI-facing compare function."""

    def test_writes_output_file(self, report_a, report_b, tmp_path):
        """run_compare writes a JSON comparison file."""
        out = tmp_path / "comparison.json"
        run_compare([str(report_a[0]), str(report_b[0])], str(out))

        assert out.exists()
        result = json.loads(out.read_text())
        assert result["run_count"] == 2

    def test_default_output_path(self, report_a, report_b, tmp_path, monkeypatch,
                                 capsys):
        """With no output path, the comparison lands beside the inputs (the
        first report's directory) and the path is printed — not in
        eval/logs/harness/, a directory the user never chose (synthetic
        researcher, 2026-10-03)."""
        elsewhere = tmp_path / "cwd"
        elsewhere.mkdir()
        monkeypatch.chdir(elsewhere)
        run_compare([str(report_a[0]), str(report_b[0])])

        from mt_eval_harness.compare import comparison_filename
        default_path = Path(report_a[0]).parent / comparison_filename(
            [str(report_a[0]), str(report_b[0])])
        assert default_path.exists()
        assert not Path("eval/logs/harness/comparison.json").exists()
        assert f"Comparison written to: {default_path}" in capsys.readouterr().out

    def test_auto_finds_reports_from_runlogs(self, tmp_path):
        """If given a RunLog, it looks for a _report.json sibling."""
        # Create a RunLog and its corresponding report
        runlog = {"results": [{"id": 0, "predicted": "x"}]}
        runlog_path = tmp_path / "run1.json"
        runlog_path.write_text(json.dumps(runlog))

        report = {
            "run_id": "run1",
            "config": {"model": "test"},
            "overall": {"evaluated": 1, "exact_match_rate": 1.0},
            "entries": [{"id": 0, "exact_match": True}],
        }
        report_path = tmp_path / "run1_report.json"
        report_path.write_text(json.dumps(report))

        # Create a second pair
        runlog2_path = tmp_path / "run2.json"
        runlog2_path.write_text(json.dumps(runlog))
        report2 = {
            "run_id": "run2",
            "config": {"model": "test2"},
            "overall": {"evaluated": 1, "exact_match_rate": 0.0},
            "entries": [{"id": 0, "exact_match": False}],
        }
        report2_path = tmp_path / "run2_report.json"
        report2_path.write_text(json.dumps(report2))

        out = tmp_path / "cmp.json"
        run_compare([str(runlog_path), str(runlog2_path)], str(out))

        assert out.exists()
        result = json.loads(out.read_text())
        assert result["run_count"] == 2


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestCompareEdgeCases:
    """Edge cases and data resilience."""

    def test_disjoint_entry_ids(self, tmp_path):
        """Reports with no overlapping entry IDs produce zero diffs."""
        r1 = {
            "run_id": "r1",
            "config": {"model": "m"},
            "overall": {"evaluated": 1},
            "entries": [{"id": 0, "exact_match": True}],
        }
        r2 = {
            "run_id": "r2",
            "config": {"model": "m"},
            "overall": {"evaluated": 1},
            "entries": [{"id": 99, "exact_match": False}],
        }
        p1 = tmp_path / "r1.json"
        p1.write_text(json.dumps(r1))
        p2 = tmp_path / "r2.json"
        p2.write_text(json.dumps(r2))

        result = compare_reports([p1, p2])
        assert result["regression_count"] == 0
        assert result["improvement_count"] == 0

    def test_empty_entries_arrays(self, tmp_path):
        """Reports with empty entries don't crash."""
        r1 = {
            "run_id": "r1",
            "config": {"model": "m"},
            "overall": {"evaluated": 0},
            "entries": [],
        }
        r2 = {
            "run_id": "r2",
            "config": {"model": "m"},
            "overall": {"evaluated": 0},
            "entries": [],
        }
        p1 = tmp_path / "r1.json"
        p1.write_text(json.dumps(r1))
        p2 = tmp_path / "r2.json"
        p2.write_text(json.dumps(r2))

        result = compare_reports([p1, p2])
        assert result["run_count"] == 2
        assert result["regression_count"] == 0

    def test_three_reports(self, report_a, report_b, tmp_path):
        """Comparison works with 3+ reports (diffs use first vs last)."""
        # Create a third report
        r3 = {
            "run_id": "run_final",
            "config": {"model": "gemini-4"},
            "overall": {"evaluated": 5, "exact_match_rate": 0.80},
            "entries": [
                {"id": i, "exact_match": True} for i in range(5)
            ],
        }
        p3 = tmp_path / "report_c.json"
        p3.write_text(json.dumps(r3))

        result = compare_reports([report_a[0], report_b[0], p3])
        assert result["run_count"] == 3
        assert len(result["overall_comparison"]) == 3

    def test_string_entry_ids_with_diffs(self, tmp_path, capsys):
        """String entry ids (all registry-built corpora) must not crash the
        regression/improvement printout, and the -o report must be written.

        Regression test for the prelaunch-audit bug: '#{id:3d}' raised
        ValueError on string ids whenever regressions/improvements existed,
        and the crash happened before the output file write.
        """
        r1 = {
            "run_id": "r1",
            "config": {"model": "m1"},
            "overall": {"evaluated": 3, "exact_match_rate": 0.67,
                        "corpus_chrf": 50.0, "total_cost_usd": 0.01},
            "entries": [
                {"id": "eng-fra-0001", "source": "Hello", "expected": "Bonjour",
                 "predicted": "Bonjour", "exact_match": True},
                {"id": "eng-fra-0002", "source": "Thanks", "expected": "Merci",
                 "predicted": "Gracias", "exact_match": False},
                {"id": "eng-fra-0003", "source": "Sky", "expected": "Ciel",
                 "predicted": "Ciel", "exact_match": True},
            ],
        }
        r2 = {
            "run_id": "r2",
            "config": {"model": "m2"},
            "overall": {"evaluated": 3, "exact_match_rate": 0.67,
                        "corpus_chrf": 55.0, "total_cost_usd": 0.02},
            "entries": [
                # regression (was correct, now wrong)
                {"id": "eng-fra-0001", "source": "Hello", "expected": "Bonjour",
                 "predicted": "Salut", "exact_match": False},
                # improvement (was wrong, now correct)
                {"id": "eng-fra-0002", "source": "Thanks", "expected": "Merci",
                 "predicted": "Merci", "exact_match": True},
                {"id": "eng-fra-0003", "source": "Sky", "expected": "Ciel",
                 "predicted": "Ciel", "exact_match": True},
            ],
        }
        p1 = tmp_path / "r1.json"
        p1.write_text(json.dumps(r1))
        p2 = tmp_path / "r2.json"
        p2.write_text(json.dumps(r2))
        out = tmp_path / "cmp.json"

        # Must not raise (was: ValueError on the string id format code)
        run_compare([str(p1), str(p2)], str(out))

        captured = capsys.readouterr()
        assert "eng-fra-0001" in captured.out  # regression printed
        assert "eng-fra-0002" in captured.out  # improvement printed

        # The -o report is written even when diffs exist
        assert out.exists()
        result = json.loads(out.read_text())
        assert result["regression_count"] == 1
        assert result["improvement_count"] == 1
        assert result["regressions"][0]["id"] == "eng-fra-0001"
        assert result["improvements"][0]["id"] == "eng-fra-0002"

    def test_mixed_entry_id_types_sortable(self, tmp_path):
        """A mix of int and string ids across the common set must not raise
        TypeError from sorted() — ids are compared by string form."""
        r1 = {"run_id": "r1", "config": {"model": "m"},
              "overall": {"evaluated": 2},
              "entries": [
                  {"id": 0, "exact_match": True},
                  {"id": "abc", "exact_match": True},
              ]}
        r2 = {"run_id": "r2", "config": {"model": "m"},
              "overall": {"evaluated": 2},
              "entries": [
                  {"id": 0, "exact_match": False},
                  {"id": "abc", "exact_match": False},
              ]}
        p1 = tmp_path / "r1.json"
        p1.write_text(json.dumps(r1))
        p2 = tmp_path / "r2.json"
        p2.write_text(json.dumps(r2))

        result = compare_reports([p1, p2])
        assert result["regression_count"] == 2

    def test_missing_config_fields(self, tmp_path):
        """Reports with sparse config fields don't crash."""
        r1 = {"run_id": "r1", "config": {}, "overall": {}, "entries": []}
        r2 = {"run_id": "r2", "config": {}, "overall": {}, "entries": []}
        p1 = tmp_path / "r1.json"
        p1.write_text(json.dumps(r1))
        p2 = tmp_path / "r2.json"
        p2.write_text(json.dumps(r2))

        result = compare_reports([p1, p2])
        assert result["run_count"] == 2
        row = result["overall_comparison"][0]
        assert row["model"] == "?"


# ---------------------------------------------------------------------------
# Scoring standard/1: chrF++ decides, by a paired test; the composite is gone
# ---------------------------------------------------------------------------

import contextlib  # noqa: E402
import io  # noqa: E402

# Distinct Northern-Sami-shaped reference sentences (40, no two alike).
_SUBJ = ["Mun", "Don", "Son", "Mii", "Dii"]
_VERB = ["oainnán", "gullen", "čállen", "lohken", "dieđán", "muitalan",
         "gávnnan", "váldán"]
_OBJ = ["girjji", "beatnaga", "viesu", "johtolaga", "mánáid", "skuvlla",
        "guoli", "fanasa"]
SME_REFS = [f"{_SUBJ[i % 5]} {_VERB[i % 8]} {_OBJ[(i * 3) % 8]} "
            f"ihttin dálvet {i}" for i in range(40)]
#: The measured failure the standard fixes: an untrained model repeating ONE
#: valid Northern Sami sentence for every input scored a composite of 0.6244
#: ('functional') at chrF++ 5.5.
CONSTANT_SENTENCE = "Mun lean buorre."


def _real(ref: str) -> str:
    """A competent translation: one word slightly off, otherwise right."""
    words = ref.split()
    words[2] = words[2][:-1] + "a"
    return " ".join(words)


def _word_dropping_glossary(ref: str) -> str:
    """A toy glossary system: looks up the words it knows, drops the rest
    (it scored a composite of 0.6612)."""
    return " ".join(ref.split()[::2])


def _standard_report(tmp_path, run_id, preds, *, standard=True, extra=None):
    entries = [{"id": f"s{i}", "source": f"source {i}", "expected": ref,
                "predicted": pred, "exact_match": pred == ref}
               for i, (ref, pred) in enumerate(zip(SME_REFS, preds))]
    overall = {"evaluated": len(entries),
               "exact_match_rate": sum(e["exact_match"] for e in entries)
               / len(entries)}
    if standard:
        overall.update({"scoring_standard": "standard/1",
                        "primary_metric": "chrf_plus_plus"})
    overall.update(extra or {})
    report = {"run_id": run_id, "config": {"model": f"m-{run_id}"},
              "overall": overall, "entries": entries}
    path = tmp_path / f"{run_id}_report.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    return path


@pytest.fixture
def three_systems(tmp_path):
    return [
        _standard_report(tmp_path, "real", [_real(r) for r in SME_REFS]),
        _standard_report(tmp_path, "constant",
                         [CONSTANT_SENTENCE] * len(SME_REFS)),
        _standard_report(tmp_path, "glossary",
                         [_word_dropping_glossary(r) for r in SME_REFS]),
    ]


def _run(paths, tmp_path, **kw):
    out = tmp_path / "comparison.json"
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        run_compare([str(p) for p in paths], str(out), **kw)
    return buf.getvalue(), json.loads(out.read_text(encoding="utf-8"))


class TestChrfDecides:

    def test_real_translation_beats_constant_and_glossary_on_chrf(
            self, three_systems, tmp_path):
        """Regression: the composite ranked a constant valid sentence
        'functional' (0.6244) and a word-dropping glossary 0.6612. On the
        standard, compare's decision — a paired test on chrF++ — says the
        real translation is significantly better than both."""
        out, data = _run(three_systems, tmp_path, significance=True,
                         n_bootstrap=200)
        decision = data["decision"]
        assert decision["metric"] == "chrf_plus_plus"
        assert decision["tested"] is True
        by_pair = {tuple(p["pair"]): p for p in decision["pairs"]}
        for pair in (("A", "B"), ("A", "C")):
            d = by_pair[pair]
            assert d["tested_as"] == "corpus_chrf"
            assert d["significant"] is True and d["better"] == "A"
            assert d["p_value"] < 0.05 and d["a_score"] > d["b_score"]
            # (the constant system carries the near-constant-output score
            # caveat, so its letter is marked ⚠ in the verdict)
            assert re.match(rf"A is better than {pair[1]}⚠? on chrF\+\+ \(\+",
                            d["verdict"]), d["verdict"]
            assert "paired approximate randomization, 200 trials" in d["verdict"]
        # The constant sentence scores low on chrF++ — far below the real
        # translation (the composite had called it 'functional').
        assert by_pair[("A", "B")]["b_score"] < 25
        flat = " ".join(out.split())
        assert re.search(r"Verdict: A is better than B⚠? on chrF\+\+", flat)
        assert re.search(r"Verdict: A is better than C⚠? on chrF\+\+", flat)

    def test_comparison_json_carries_the_standard_and_no_composite(
            self, three_systems, tmp_path):
        out, data = _run(three_systems[:2], tmp_path, significance=True,
                         n_bootstrap=100)
        assert data["scoring_standard"] == "standard/1"
        assert data["primary_metric"] == "chrf_plus_plus"
        assert "composite_direction" not in data
        assert "legacy_composite" not in data
        for row in data["overall_comparison"]:
            assert "composite" not in row
            assert "composite_includes_terminology" not in row
            assert row["scoring_standard"] == "standard/1"
        tests = data["significance"]
        assert tests[0]["metric_name"] == "corpus_chrf"
        assert tests[0]["role"] == "primary"
        roles = {t["metric_name"]: t["role"] for t in tests}
        assert roles["corpus_bleu"] == roles["corpus_ter"] == "secondary"
        assert roles["exact_match_rate"] == "diagnostic"
        assert not any("composite" in t["metric_name"] for t in tests)
        settings = data["significance_settings"]
        assert settings["primary_metric"] == "chrf_plus_plus"
        assert "chrF++ (corpus_chrf) decides" in settings["decision_rule"]
        assert "chrF++ is the pre-declared primary metric" in \
            settings["multiple_testing_note"]
        # The run table: chrF++ first among the metrics, marked primary;
        # diagnostics under their own heading; no composite row.
        assert "Composite" not in out
        lines = out.splitlines()
        chrf = next(i for i, l in enumerate(lines) if "chrF++ (corpus) — primary" in l)
        diag = next(i for i, l in enumerate(lines)
                    if l.strip().startswith("Diagnostics (not used to decide):"))
        exact = next(i for i, l in enumerate(lines) if "Exact match" in l)
        assert chrf < diag < exact

    def test_without_significance_no_run_is_called_better(
            self, three_systems, tmp_path):
        out, data = _run(three_systems[:2], tmp_path, significance=False)
        decision = data["decision"]
        assert decision["tested"] is False and decision["pairs"] == []
        assert "--significance" in decision["why"]
        flat = " ".join(out.split())
        assert "Decision: not made — no paired significance test was run" in flat
        assert "Verdict:" not in out

    def test_no_significant_difference_is_said_as_such(self, tmp_path):
        a = _standard_report(tmp_path, "a", [_real(r) for r in SME_REFS])
        b = _standard_report(tmp_path, "b", [_real(r) for r in SME_REFS])
        out, data = _run([a, b], tmp_path, significance=True, n_bootstrap=100)
        d = data["decision"]["pairs"][0]
        assert d["better"] is None and d["significant"] is False
        assert d["verdict"].startswith(
            "no significant difference on chrF++ between A and B (Δ A−B +0.0, p=1.000")

    def test_a_legacy_report_is_said_once_to_carry_a_retired_composite(
            self, three_systems, tmp_path):
        legacy = _standard_report(
            tmp_path, "old", [_real(r) for r in SME_REFS], standard=False,
            extra={"published_composite": {"score": 0.6244,
                                           "quality_tier": "functional"},
                   "confidence_intervals": {"segment_composite": {
                       "score": 0.5, "ci_lower": 0.4, "ci_upper": 0.6}}})
        out, data = _run([legacy, three_systems[1]], tmp_path,
                         significance=True, n_bootstrap=100)
        assert data["legacy_composite"]["runs"] == ["A"]
        assert data["legacy_composite"]["label"] == "legacy composite (retired)"
        assert data["overall_comparison"][0]["scoring_standard"] == \
            "legacy-composite"
        flat = " ".join(out.split())
        assert flat.count("A was scored before scoring standard/1 and carries "
                          "a legacy composite (retired): it is not shown or "
                          "compared here.") == 1
        assert "0.6244" not in out and "functional" not in out
        # chrF++ still decides for the legacy report: it is computed from
        # the same entries.
        assert data["decision"]["pairs"][0]["better"] == "A"

    def test_chrf_ci_and_signature_are_shown(self, tmp_path):
        sig = "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.0"
        extra = {"corpus_chrf": 47.5,
                 "confidence_intervals": {"corpus_chrf": {
                     "score": 47.5, "ci_lower": 45.9, "ci_upper": 49.0}},
                 "sacrebleu_signatures": {"chrf": sig}}
        a = _standard_report(tmp_path, "a", [_real(r) for r in SME_REFS],
                             extra=extra)
        b = _standard_report(tmp_path, "b", [_real(r) for r in SME_REFS],
                             extra=extra)
        out, data = _run([a, b], tmp_path, significance=False)
        assert data["overall_comparison"][0]["corpus_chrf_ci"] == [45.9, 49.0]
        row = next(l for l in out.splitlines() if "chrF++ (corpus) — primary" in l)
        assert "47.5 [45.9, 49.0]" in row
        assert f"chrF++ signature: {sig}" in " ".join(out.split())

    def test_comet_is_tested_as_secondary_from_per_segment_scores(self, tmp_path):
        def with_comet(run_id, preds, base):
            p = _standard_report(tmp_path, run_id, preds,
                                 extra={"comet_score": base,
                                        "comet_model": "Unbabel/wmt22-comet-da"})
            data = json.loads(p.read_text())
            for i, e in enumerate(data["entries"]):
                e["comet_score"] = base + (i % 5) * 0.01
            p.write_text(json.dumps(data))
            return p
        a = with_comet("a", [_real(r) for r in SME_REFS], 0.80)
        b = with_comet("b", [CONSTANT_SENTENCE] * len(SME_REFS), 0.30)
        _out, data = _run([a, b], tmp_path, significance=True, n_bootstrap=100)
        comet = next(t for t in data["significance"]
                     if t["metric_name"] == "comet_score")
        assert comet["role"] == "secondary" and comet["direction"] == "higher"
        assert comet["system_a_score"] == pytest.approx(0.82, abs=1e-4)
        assert comet["significant"] is True
        # Different COMET models: not tested, and said why.
        data_b = json.loads(b.read_text())
        data_b["overall"]["comet_model"] = "Unbabel/XCOMET-XL"
        b.write_text(json.dumps(data_b))
        _out, data = _run([a, b], tmp_path, significance=True, n_bootstrap=100)
        assert not any(t["metric_name"] == "comet_score"
                       for t in data["significance"])
        assert any("different COMET models" in n
                   for n in data["significance_settings"]["notes"])
