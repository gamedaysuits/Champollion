"""Tests for by_domain aggregation in tester.py.

Verifies that analyze_run_log groups entries by their domain field
and computes per-domain metric breakdowns correctly.

Key behaviors validated:
    - Entries are grouped by their domain field
    - Missing domain defaults to '' (empty string), not a fallback code
    - Each domain group has correct entry counts
    - Metrics are computed per domain using _aggregate_group()
"""

import pytest

from mt_eval_harness.tester import analyze_run_log


def _make_result(entry_id, domain=None, predicted="output", expected="expected",
                 segment="basic", difficulty=1):
    """Build a minimal RunLog result entry with an optional domain."""
    r = {
        "id": entry_id,
        "source": f"source_{entry_id}",
        "expected": expected,
        "predicted": predicted,
        "segment": segment,
        "difficulty": difficulty,
        "latency_s": 0.5,
        "cost_usd": 0.001,
        "tool_call_count": 0,
        "error": None,
    }
    if domain is not None:
        r["domain"] = domain
    return r


def _make_run_log(results):
    """Wrap results in a minimal RunLog dict."""
    return {
        "run_id": "test_domain_run",
        "config": {
            "model": "test-model",
            "source_field": "source",
            "target_field": "target",
        },
        "results": results,
    }


class TestByDomainAggregation:
    """Verify that by_domain groups entries correctly."""

    def test_by_domain_present_in_report(self):
        """Report must contain a by_domain key."""
        run_log = _make_run_log([
            _make_result(0, domain="legal"),
            _make_result(1, domain="medical"),
        ])
        report = analyze_run_log(run_log, output_path=None, compute_ci=False)
        assert "by_domain" in report

    def test_correct_domain_keys(self):
        """by_domain should have one key per distinct domain value."""
        run_log = _make_run_log([
            _make_result(0, domain="legal"),
            _make_result(1, domain="legal"),
            _make_result(2, domain="medical"),
            _make_result(3, domain="tech"),
        ])
        report = analyze_run_log(run_log, output_path=None, compute_ci=False)
        domain_keys = set(report["by_domain"].keys())
        assert domain_keys == {"legal", "medical", "tech"}

    def test_correct_entry_counts(self):
        """Each domain group should have the correct entry count."""
        run_log = _make_run_log([
            _make_result(0, domain="legal"),
            _make_result(1, domain="legal"),
            _make_result(2, domain="legal"),
            _make_result(3, domain="medical"),
            _make_result(4, domain="tech"),
            _make_result(5, domain="tech"),
        ])
        report = analyze_run_log(run_log, output_path=None, compute_ci=False)
        by_domain = report["by_domain"]
        assert by_domain["legal"]["count"] == 3
        assert by_domain["medical"]["count"] == 1
        assert by_domain["tech"]["count"] == 2

    def test_missing_domain_goes_to_empty_string_group(self):
        """Entries without a domain field should land in the '' group.

        NO silent fallback to 'conv' or any other default code.
        """
        run_log = _make_run_log([
            _make_result(0, domain="legal"),
            _make_result(1),  # no domain key at all
            _make_result(2),  # no domain key at all
        ])
        report = analyze_run_log(run_log, output_path=None, compute_ci=False)
        by_domain = report["by_domain"]
        # The empty-string key holds entries without a domain
        assert "" in by_domain
        assert by_domain[""]["count"] == 2
        assert by_domain["legal"]["count"] == 1

    def test_exact_match_metrics_per_domain(self):
        """Verify that exact match counts are correct per domain."""
        run_log = _make_run_log([
            # legal: 1 exact match out of 2
            _make_result(0, domain="legal", predicted="match", expected="match"),
            _make_result(1, domain="legal", predicted="wrong", expected="right"),
            # medical: 2 exact matches out of 2
            _make_result(2, domain="medical", predicted="yes", expected="yes"),
            _make_result(3, domain="medical", predicted="no", expected="no"),
        ])
        report = analyze_run_log(run_log, output_path=None, compute_ci=False)
        by_domain = report["by_domain"]
        assert by_domain["legal"]["exact_match_count"] == 1
        assert by_domain["medical"]["exact_match_count"] == 2

    def test_single_domain_still_present(self):
        """Even if all entries share one domain, by_domain should exist."""
        run_log = _make_run_log([
            _make_result(0, domain="news"),
            _make_result(1, domain="news"),
        ])
        report = analyze_run_log(run_log, output_path=None, compute_ci=False)
        assert "news" in report["by_domain"]
        assert report["by_domain"]["news"]["count"] == 2

    def test_all_16_domains_supported(self):
        """All 16 valid domain codes should work as grouping keys."""
        valid_domains = [
            "ui", "legal", "medical", "financial", "edu", "ecommerce",
            "marketing", "gov", "scientific", "religious", "support",
            "subtitles", "news", "literary", "conv", "tech",
        ]
        results = [
            _make_result(i, domain=d) for i, d in enumerate(valid_domains)
        ]
        run_log = _make_run_log(results)
        report = analyze_run_log(run_log, output_path=None, compute_ci=False)
        by_domain = report["by_domain"]
        for d in valid_domains:
            assert d in by_domain, f"Domain '{d}' missing from by_domain"
            assert by_domain[d]["count"] == 1

    def test_error_entries_counted_in_domain(self):
        """Entries with errors should still be counted in their domain group."""
        run_log = _make_run_log([
            _make_result(0, domain="legal"),
            {
                "id": 1,
                "source": "source_1",
                "expected": "expected",
                "predicted": "",
                "segment": "basic",
                "difficulty": 1,
                "domain": "legal",
                "latency_s": 0.0,
                "cost_usd": 0.0,
                "tool_call_count": 0,
                "error": "API timeout",
            },
        ])
        report = analyze_run_log(run_log, output_path=None, compute_ci=False)
        by_domain = report["by_domain"]
        assert by_domain["legal"]["count"] == 2
        assert by_domain["legal"]["error_count"] == 1
