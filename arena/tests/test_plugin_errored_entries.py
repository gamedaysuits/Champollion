"""An entry a plugin raised on is not a clean entry.

tester.py stores ``{"error": str(exc)}`` for an entry whose ``compute()``
raised. The code-switching and hallucination aggregates read the missing
rate as 0.0, so an entry the plugin never scored lowered the averages and
the flagged share — the run looked cleaner than what was measured. They now
leave such entries out and count them (``entries_errored``), the way
code switching already counted ``entries_unjudged``; a plugin that scored
no entry publishes no rate, and the card and the run card say why.

All text below is invented (pseudo-words), no corpus content.
"""

import json

from mt_eval_harness.plugins.code_switching import CodeSwitchingPlugin
from mt_eval_harness.plugins.hallucination import HallucinationPlugin
from mt_eval_harness.publish import derive_scores
from mt_eval_harness.run_card import flagged_entries_text, render_run_card
from mt_eval_harness.tester import analyze_run_log


def _cs(rate, wrong=0):
    return {"code_switching_rate": rate, "cs_wrong_script_tokens": wrong,
            "cs_total_tokens": 2, "cs_untranslated_run_tokens": 0}


def _hall(rate, length=0.0):
    return {"hallucination_rate": rate, "hall_length_score": length,
            "hall_repetition_score": 0.0, "hall_entity_score": 0.0,
            "hall_echo_score": 0.0}


ERR = {"error": "boom"}


class TestCodeSwitchingAggregate:
    def test_an_errored_entry_is_left_out_and_counted(self):
        agg = CodeSwitchingPlugin(target_scripts=["Cyrillic"]).aggregate(
            [_cs(0.0), dict(ERR), _cs(0.5, wrong=1)])
        # over the two scored entries, not three (0.1667 / 33% before)
        assert agg["avg_code_switching_rate"] == 0.25
        assert agg["entries_with_code_switching"] == 1
        assert agg["entries_with_code_switching_pct"] == 0.5
        assert agg["entries_errored"] == 1
        assert "entries_unjudged" not in agg

    def test_errored_and_unjudged_are_counted_apart(self):
        unjudged = {"code_switching_rate": None, "cs_unjudged": "no_target_script"}
        agg = CodeSwitchingPlugin().aggregate(
            [_cs(0.5, wrong=1), dict(ERR), unjudged, dict(ERR)])
        assert agg["avg_code_switching_rate"] == 0.5
        assert agg["entries_errored"] == 2 and agg["entries_unjudged"] == 1

    def test_no_entry_scored_gives_no_rate(self):
        assert CodeSwitchingPlugin().aggregate([dict(ERR), dict(ERR)]) == \
            {"entries_errored": 2}

    def test_a_clean_run_carries_no_count(self):
        agg = CodeSwitchingPlugin().aggregate([_cs(0.0), _cs(0.0)])
        assert "entries_errored" not in agg and "entries_unjudged" not in agg


class TestHallucinationAggregate:
    def test_an_errored_entry_is_left_out_and_counted(self):
        agg = HallucinationPlugin().aggregate(
            [_hall(0.0), dict(ERR), _hall(0.5, length=0.3)])
        assert agg["avg_hallucination_rate"] == 0.25
        assert agg["max_hallucination_rate"] == 0.5
        assert agg["entries_flagged_hallucination"] == 1
        assert agg["entries_flagged_hallucination_pct"] == 0.5
        assert agg["avg_length_score"] == 0.15
        assert agg["entries_errored"] == 1

    def test_no_entry_scored_gives_no_rate(self):
        assert HallucinationPlugin().aggregate([dict(ERR)]) == {"entries_errored": 1}

    def test_a_clean_run_carries_no_count(self):
        assert "entries_errored" not in HallucinationPlugin().aggregate([_hall(0.0)])


# ---------------------------------------------------------------------------
# Through the tester: a plugin that raises on some entries
# ---------------------------------------------------------------------------

class _RaisingCS(CodeSwitchingPlugin):
    def __init__(self, raise_on):
        super().__init__(target_scripts=["Cyrillic"])
        self.raise_on = raise_on

    def compute(self, entry):
        if entry["id"] in self.raise_on:
            raise RuntimeError("tokenizer fell over")
        return super().compute(entry)


class _RaisingHall(HallucinationPlugin):
    def __init__(self, raise_on):
        super().__init__()
        self.raise_on = raise_on

    def compute(self, entry):
        if entry["id"] in self.raise_on:
            raise RuntimeError("tokenizer fell over")
        return super().compute(entry)


def _result(entry_id, source, predicted, expected):
    return {"id": entry_id, "source": source, "expected": expected,
            "predicted": predicted, "segment": "basic", "difficulty": 1,
            "latency_s": 0.1, "cost_usd": 0.0, "tool_call_count": 0,
            "error": None}


def _run(tmp_path, raise_on):
    run_log = {
        "run_id": "run_errored_plugin",
        "config": {"model": "test-model", "source_field": "source",
                   "target_field": "target"},
        "results": [
            _result("1", "the old dog", "бруш тал", "бруш тал"),
            _result("2", "a red box", "dog зор", "вин зор"),
            _result("3", "the dog sleeps", "бруш dog", "бруш мил"),
        ],
    }
    log_path = tmp_path / "run_errored_plugin.json"
    log_path.write_text(json.dumps(run_log), encoding="utf-8")
    report_path = tmp_path / "run_errored_plugin_report.json"
    report = analyze_run_log(
        run_log, output_path=report_path, compute_ci=False,
        metric_plugins=[_RaisingCS(raise_on), _RaisingHall(raise_on)],
        source_log_path=str(log_path))
    return run_log, report, log_path, report_path


def test_tester_leaves_the_errored_entry_out(tmp_path):
    _, report, log_path, report_path = _run(tmp_path, raise_on={"2"})
    pm = report["overall"]["plugin_metrics"]
    # entry 2 (itself code-switched) raised: the rates are over 1 and 3 only
    assert pm["code_switching"]["avg_code_switching_rate"] == 0.25
    assert pm["code_switching"]["entries_with_code_switching_pct"] == 0.5
    assert pm["code_switching"]["entries_errored"] == 1
    assert pm["hallucination"]["entries_errored"] == 1
    # the rate is published, and is not called null
    avail = report["overall"]["metric_availability"]
    assert "code_switching_rate" not in avail
    assert "hallucination_rate" not in avail
    card = render_run_card(log_path, report_path)
    assert "1 entries (50.0%); 1 errored, not scored" in card


def test_a_plugin_that_scored_nothing_publishes_no_rate(tmp_path):
    run_log, report, log_path, report_path = _run(tmp_path, raise_on={"1", "2", "3"})
    pm = report["overall"]["plugin_metrics"]
    assert pm["code_switching"] == {"entries_errored": 3}
    assert pm["hallucination"] == {"entries_errored": 3}
    derived = derive_scores(report, run_log, report_path)
    assert derived["code_switching_rate"] is None      # was 0.0: clean
    assert derived["hallucination_rate"] is None
    avail = report["overall"]["metric_availability"]
    assert avail["code_switching_rate"] == \
        "not_computed: no entry was scored (the plugin raised on 3)"
    assert avail["hallucination_rate"] == \
        "not_computed: no entry was scored (the plugin raised on 3)"
    card = render_run_card(log_path, report_path)
    assert "0 entries (0.0%)" not in card
    assert "not measured; 3 errored, not scored" in card


def test_publish_says_why_a_rate_is_null():
    from mt_eval_harness.publish import _build_metric_availability

    def avail(plugin_metrics, **scores):
        return _build_metric_availability(
            scores=scores, plugin_metrics=plugin_metrics, has_fst=False,
            morph_accuracy=None, morph_coverage=None, morph_floor=0.25,
            has_glossary=False, has_references=True, metricx_requested=False)

    a = avail({"code_switching": {"entries_errored": 1, "entries_unjudged": 2},
               "hallucination": {"error": "aggregate fell over"}})
    assert a["code_switching_rate"] == (
        "not_computed: no entry was scored (the plugin raised on 1; 2 had no "
        "target script to judge against — name one with --target-script)")
    assert a["hallucination_rate"] == "not_computed: aggregate fell over"
    # a computed rate needs no reason, even with entries left out of it
    a = avail({"code_switching": {"avg_code_switching_rate": 0.1,
                                  "entries_errored": 1}},
              code_switching_rate=0.1)
    assert "code_switching_rate" not in a
    # a plugin that did not run says nothing it cannot know
    assert "hallucination_rate" not in a


def test_the_card_line_names_what_was_not_scored():
    keys = ("entries_with_code_switching", "entries_with_code_switching_pct")
    assert flagged_entries_text(
        {"entries_with_code_switching": 2, "entries_with_code_switching_pct": 0.4},
        *keys) == "2 entries (40.0%)"
    assert flagged_entries_text({"entries_unjudged": 4}, *keys) == \
        "not measured; 4 not judged"
    # the aggregate itself raised (tester stores its error on the block)
    assert flagged_entries_text({"error": "aggregate fell over"}, *keys) == \
        "aggregate fell over"
