"""Round 6 synthetic users (researcher, school, hospital), 2026-10-03.

1. A 45-word lookup table that DROPS unknown words scored a published
   composite of 0.548 on eng→sme (FST acceptance maxed on an acceptor-only
   FST) — over twice what full-length outputs scored — with nothing said.
   New ``length_deflation`` score caveat; weights unchanged (founder).
2. The sealed-run summary printed the 0-1 composite and the 0-100 qualifier
   score both as "composite".
3. One local model's cost read "$0.0000", "unknown" and "$0 API cost" across
   the dry run, compare and the card.
4. `mt-eval run` pip-installed pyhfst by itself (consent via --yes / CI).
5. `contest validate` minted a second qualifier receipt under the bundle's
   name.
6. `--parameter-count` is checked against the safetensors count, which the
   help never said.
7. The --power-pilot MDE appeared only after a signed-in registration.
8. `mt-eval corpora --target sme` refused without --source.
"""

from __future__ import annotations

import contextlib
import io
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from mt_eval_harness import publish, score_caveats
from mt_eval_harness.compare import compare_reports, format_comparison_table
from mt_eval_harness.publish import assemble_run_card
from mt_eval_harness.run_card import render_run_card
from mt_eval_harness.tester import analyze_run_log

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "mt_eval_harness"

ROWS = [
    ("Where does it hurt?", "Gos bávččas dutnje dál?"),
    ("Take this medicine twice a day.", "Váldde dán dálkkasa guktii beaivvis."),
    ("The doctor is coming soon.", "Doavttir boahtá fargga dása."),
    ("Please sit down here.", "Čohkkán dása, leat buorre."),
]


@pytest.fixture(autouse=True)
def _no_git(monkeypatch):
    monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)
    monkeypatch.setattr(publish, "_is_prod_target", lambda: False)


def _run_log(name, outputs, *, config=None, provenance=None, cached=False,
             cost=0.0, total=0.0):
    results = [{"id": i, "source": s, "expected": r, "predicted": o,
                "raw_predicted": o, "latency_s": 0.1, "cost_usd": cost,
                "cached": cached, "error": None}
               for i, ((s, r), o) in enumerate(zip(ROWS, outputs))]
    return {
        "run_id": name, "harness_version": "0.2.0",
        "timestamp_start": "2026-10-03T00:00:00Z", "elapsed_s": 1.0,
        "total_cost_usd": total, "cache_hits": len(results) if cached else 0,
        "config": {"model": f"test/{name}", "prompt_version": "naive",
                   "temperature": 0.0, "batch_size": 1, "max_tokens": 256,
                   "dataset_id": "round6-test", "source_lang": "English",
                   "target_lang": "French", "provider": "local",
                   **(config or {})},
        "provenance": {"corpus_sha256": "c" * 64,
                       "system_prompt_sha256": "d" * 64,
                       "dataset_meta": {"version": "1"},
                       **(provenance or {})},
        "results": results,
    }


def _analyze(tmp_path, run_log, plugins=None):
    tmp_path.mkdir(parents=True, exist_ok=True)
    log_path = tmp_path / f"{run_log['run_id']}.json"
    log_path.write_text(json.dumps(run_log), encoding="utf-8")
    report_path = tmp_path / f"{run_log['run_id']}_report.json"
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        report = analyze_run_log(run_log, output_path=report_path,
                                 metric_plugins=plugins or [],
                                 compute_ci=False,
                                 source_log_path=str(log_path))
    return report_path, report, out.getvalue()


# Words kept, the rest dropped: what a lookup table that skips unknown words
# emits. Each output is under half its reference's length.
DROPPED = ["Gos", "dálkkasa", "Doavttir", "dása"]


def _code_switching():
    from mt_eval_harness.plugins.code_switching import CodeSwitchingPlugin
    return CodeSwitchingPlugin(target_scripts=["Latin"], source_script="Latin")


# ---------------------------------------------------------------------------
# 1. length_deflation — dropping words, said beside the composite
# ---------------------------------------------------------------------------

class TestLengthDeflation:

    def test_bounds_are_the_spec_truncation_bound(self):
        assert score_caveats.LENGTH_DEFLATION_RATIO == 0.5
        ok = [{"expected": "x", "length_ratio": 0.9}] * 4
        assert not score_caveats.length_deflation(ok)["flagged"]
        quarter = ok[:3] + [{"expected": "x", "length_ratio": 0.2}]
        assert score_caveats.length_deflation(quarter)["flagged"]   # 25 %
        few = ok * 2 + [{"expected": "x", "length_ratio": 0.2}]
        assert not score_caveats.length_deflation(few)["flagged"]   # 11 %
        low_mean = [{"expected": "x", "length_ratio": 0.45}] * 3
        assert score_caveats.length_deflation(low_mean)["flagged"]
        # an empty output dropped everything — it counts; an error does not
        empty = [{"expected": "x", "length_ratio": 0.0},
                 {"expected": "x", "length_ratio": 0.0, "error": "boom"}]
        assert score_caveats.length_deflation(empty)["scored"] == 1
        assert score_caveats.length_deflation([]) is None

    def test_reproduction_numbers_and_unchanged_weights(self):
        """The Round 6 lookup table, as recorded for the founder: 0.5481 with
        FST acceptance carrying 0.25/0.55 of an acceptor-only composite. The
        weights are not touched by this fix."""
        from mt_eval_harness.scoring import compute_composite_score
        toy = {"fst_acceptance_rate": 0.76, "chrf_plus_plus": 11.8,
               "code_switching_rate": 0.0, "hallucination_rate": 0.1251,
               "exact_match_rate": 0.0}
        assert round(compute_composite_score(toy, profile="fst-coverage"), 4) \
            == 0.5481
        # mean 0.4668 with 16 of 25 under 0.5 — flagged on both rules
        ratios = [0.2] * 16 + [1.0] * 9
        stats = score_caveats.length_deflation(
            [{"expected": "x", "length_ratio": r} for r in ratios])
        assert stats["flagged"] and stats["short_entries"] == 16

    def test_major_when_a_metric_judges_only_present_words(self):
        entries = [{"expected": "x", "length_ratio": 0.3}] * 4
        overall = {"plugin_metrics": {
            "giellalt_fst_validity": {"avg_fst_validity": 0.76},
            "code_switching": {"avg_code_switching_rate": 0.0}}}
        (cav,) = score_caveats.collect({"entries": entries, "overall": overall})
        assert cav["kind"] == score_caveats.LENGTH_DEFLATION
        assert cav["severity"] == "major"
        assert cav["emitted_only_metrics"] == ["FST acceptance",
                                               "code-switching"]
        # Scoring standard/1: the diagnostics read well for the wrong
        # reason; the chrF++ headline counts the missing words.
        assert "do not read them as quality" in cav["message"]
        assert "chrF++ headline" in cav["message"]
        assert "composite" not in cav["message"]
        assert "truncation bound" in cav["message"]
        assert len(cav["message"]) <= score_caveats.MESSAGE_CAP
        assert score_caveats.short_label(cav) == "0.30× length — words dropped"

    def test_minor_on_the_contest_lane(self):
        """chrF++ + exact match only (the contest lane) count missing words:
        a note, not a warning that the composite is gamed."""
        entries = [{"expected": "x", "length_ratio": 0.3}] * 4
        (cav,) = score_caveats.collect({"entries": entries, "overall": {}})
        assert cav["severity"] == "minor"
        assert cav["emitted_only_metrics"] == []
        assert "FST" not in cav["message"]

    def test_full_length_outputs_get_no_caveat(self, tmp_path):
        _, report, _ = _analyze(tmp_path, _run_log("full", [r for _, r in ROWS]),
                                plugins=[_code_switching()])
        assert not any(c["kind"] == score_caveats.LENGTH_DEFLATION
                       for c in report.get("score_caveats") or [])

    def test_every_surface_says_it(self, tmp_path, capsys):
        report_path, report, out = _analyze(
            tmp_path / "d", _run_log("dropped", DROPPED),
            plugins=[_code_switching()])
        stats = report["overall"]["length_deflation"]
        assert stats["flagged"] and stats["mean_ratio"] < 0.5
        # test summary — beside the headline
        assert "SCORE CAVEAT (mt-eval-harness)" in out
        assert "words were left out" in out
        # run card
        card_text = render_run_card(tmp_path / "d" / "dropped.json", report_path)
        assert "words were left out" in card_text
        # published card
        card, _, _ = assemble_run_card(report_path)
        kinds = [c["kind"] for c in card["score_caveats"]]
        assert score_caveats.LENGTH_DEFLATION in kinds
        # publish preview
        publish.publish_to_supabase(str(report_path), dry_run=True,
                                    auto_confirm=True)
        assert "words were left out" in capsys.readouterr().out
        # compare
        full, _, _ = _analyze(tmp_path / "f", _run_log("full", [r for _, r in ROWS]),
                              plugins=[_code_switching()])
        table = format_comparison_table(
            compare_reports([report_path, full])["overall_comparison"])
        assert "words dropped" in table
        # dashboard
        from mt_eval_harness.dashboard import _load_one
        assert any(c["kind"] == score_caveats.LENGTH_DEFLATION
                   for c in _load_one(str(report_path))["score_caveats"])

    def test_qualify_carries_the_caveats(self, tmp_path, capsys):
        # Scoring standard/1: qualify's orientation composite is retired; the
        # caveats are read from the contest lane's own scoring of the dev
        # outputs and printed beside the chrF++ qualifier score.
        from mt_eval_harness.contest_qualify import qualify
        corpus = tmp_path / "dev.json"
        corpus.write_text(json.dumps({
            "dataset": {"corpus_id": "eval-eng-sme-r6-qualifier-v2026",
                        "language_pair": {"source": "eng", "target": "sme"},
                        "license": "CC0-1.0"},
            "entries": [{"id": i, "source": s_, "reference": r}
                        for i, (s_, r) in enumerate(ROWS)]}),
            encoding="utf-8")
        hyps = tmp_path / "hyps.txt"
        hyps.write_text("\n".join(DROPPED) + "\n", encoding="utf-8")
        qid = "eval-eng-sme-r6-qualifier-v2026"
        qualify("r6-contest", dev_hyp_path=hyps, dev_corpus_path=corpus,
                system_label="dropper", method_class="pipeline",
                receipt_dir=tmp_path / "receipts",
                offline_qualifier={"qualifier_id": qid, "corpus_card_id": qid,
                                   "threshold": 1.0,
                                   "language_pair": "eng>sme", "year": 2026})
        out = capsys.readouterr().out
        assert "words were left out" in out
        assert "for orientation" not in out


# ---------------------------------------------------------------------------
# 2. Every composite / qualifier number names its scale
# ---------------------------------------------------------------------------

class TestScales:

    def test_scales_phrase(self):
        # Scoring standard/1: the qualifier score is corpus chrF++ (0-100);
        # scales_phrase (the retired composite on two scales) is gone.
        from mt_eval_harness import qualifier_gate
        from mt_eval_harness.qualifier_gate import (
            qualifier_score_phrase, score_phrase)
        assert not hasattr(qualifier_gate, "scales_phrase")
        assert (score_phrase(14.97) ==
                "chrF++ 14.97 (the chrF++ 0-100 qualifier)")
        assert (score_phrase(14.97, 12.1, 17.92) ==
                "chrF++ 14.97 [12.1, 17.92] (the chrF++ 0-100 qualifier)")
        assert score_phrase(None) == "chrF++ not computed"
        assert (qualifier_score_phrase(35.0) ==
                "35 on the chrF++ 0-100 qualifier scale")
        assert qualifier_score_phrase(None) == "not recorded"

    def test_no_summary_line_calls_the_qualifier_score_composite(self):
        """The bug's shape: '(composite {…qualifier_score…})'."""
        import re
        pat = re.compile(r"composite \{[^}]*qualifier_score")
        for f in ("sandbox_runner.py", "airgap_transport.py",
                  "contest_node.py"):
            text = (PKG / f).read_text(encoding="utf-8")
            assert not pat.search(text), f
            assert "q={r.get('qualifier_score')}" not in text, f

    def test_signed_manifest_names_both_scales(self):
        # Scoring standard/1: the signed manifest carries corpus chrF++ (0-100)
        # with its CI under their own names, and no composite on any scale.
        text = (PKG / "airgap_transport.py").read_text(encoding="utf-8")
        assert 'scores={"composite": result["qualifier_score"]}' not in text
        assert '("composite", result.get("composite"))' not in text
        assert '("chrf_plus_plus", result.get("chrf_plus_plus"))' in text
        assert '("chrf_ci_lower", result.get("chrf_ci_lower"))' in text

    def test_report_and_card_label_the_headline_scale(self, tmp_path):
        # Scoring standard/1: the headline is chrF++ on 0-100; no composite
        # (on any scale) is printed by the summary or the card.
        rp, _, out = _analyze(tmp_path, _run_log("scale", [r for _, r in ROWS]))
        line = next(l for l in out.splitlines() if "Headline:" in l)
        assert "chrF++" in line and "0-100" in line
        assert "Composite" not in out
        card = render_run_card(tmp_path / "scale.json", rp)
        assert "Composite" not in card and "— published" not in card


# ---------------------------------------------------------------------------
# 3. One run, one cost wording
# ---------------------------------------------------------------------------

LOCAL = {"endpoint_locality": "loopback"}


class TestOneCostLabel:

    def test_unpriced_all_cache_rerun_is_unknown_not_zero(self, tmp_path):
        log = _run_log("rerun", [r for _, r in ROWS], cached=True, cost=None,
                       total=None, provenance=LOCAL)
        _, report, out = _analyze(tmp_path, log)
        assert report["overall"]["total_cost_usd"] is None
        # Round 9: a loopback run is not of UNKNOWN cost — it made no API
        # call. The price total stays null; cost_unknown agrees with the
        # label, and api_cost_usd says what was paid in API calls.
        assert report["overall"]["cost_unknown"] is False
        assert report["overall"]["api_cost_usd"] == 0.0
        assert report["endpoint_locality"] == "loopback"
        assert "Total cost:       $0 API cost (runs on this machine)" in out

    def test_priced_all_cache_rerun_is_a_real_zero(self, tmp_path):
        log = _run_log("priced", [r for _, r in ROWS], cached=True, cost=0.002,
                       config={"provider": "openrouter"})
        _, report, _ = _analyze(tmp_path, log)
        assert report["overall"]["total_cost_usd"] == 0.0

    def test_run_total_cost_reads_the_runlog_first(self):
        from mt_eval_harness.run_card import run_total_cost
        legacy = {"overall": {"total_cost_usd": 0},
                  "entries": [{"cost_usd": None}, {"cost_usd": None}]}
        assert run_total_cost(None, legacy) is None   # old report's fake $0
        assert run_total_cost({"total_cost_usd": None}, legacy) is None
        assert run_total_cost({"total_cost_usd": 0.0123}, legacy) == 0.0123
        priced = {"overall": {"total_cost_usd": 0.0},
                  "entries": [{"cost_usd": 0.001}]}
        assert run_total_cost(None, priced) == 0.0

    def test_compare_reads_two_runs_of_one_local_model_alike(self, tmp_path):
        fresh, _, _ = _analyze(tmp_path / "a", _run_log(
            "fresh", [r for _, r in ROWS], cost=None, total=None,
            provenance=LOCAL))
        rerun, _, _ = _analyze(tmp_path / "b", _run_log(
            "rerun", [r for _, r in ROWS], cost=None, total=None, cached=True,
            provenance=LOCAL))
        rows = compare_reports([fresh, rerun])["overall_comparison"]
        assert rows[0]["cost_label"] == rows[1]["cost_label"] == \
            "$0 API cost (runs on this machine)"
        table = format_comparison_table(rows)
        cost_row = next(l for l in table.splitlines() if "Total cost" in l)
        assert cost_row.count("$0 API cost") == 2
        assert "$0.0000" not in table and "unknown" not in cost_row
        assert "Cost: A $0 API cost (runs on this machine)" in table

    def test_estimate_uses_the_same_rule(self):
        from mt_eval_harness.run_card import cost_estimate_label
        assert cost_estimate_label(None, "self-contained method",
                                   {"mt_method": "local-model"},
                                   {"endpoint_locality": "in-process"}) == \
            "$0 API cost (runs on this machine)"
        assert cost_estimate_label(None, "no price", {"provider": "local"},
                                   LOCAL) == "$0 API cost (runs on this machine)"
        assert cost_estimate_label(None, "UNKNOWN — no price data",
                                   {"provider": "openrouter"}, {}) == \
            "unknown — UNKNOWN — no price data"
        assert cost_estimate_label(0.0012, "heuristic", {}, {}) == \
            "~$0.0012 (heuristic)"

    def test_runner_locality_covers_the_in_process_adapter(self):
        from mt_eval_harness.runner import _endpoint_locality
        loop = SimpleNamespace(name="local", is_loopback_endpoint=lambda: True)
        remote = SimpleNamespace(name="local", is_loopback_endpoint=lambda: False)
        assert _endpoint_locality(loop, None) == "loopback"
        assert _endpoint_locality(remote, None) is None
        assert _endpoint_locality(None, "local-model") == "in-process"
        assert _endpoint_locality(None, None) is None

    def test_card_dashboard_queue_and_publish_agree(self, tmp_path):
        log = _run_log("agree", [r for _, r in ROWS], cost=None, total=None,
                       cached=True, provenance=LOCAL)
        rp, _, _ = _analyze(tmp_path, log)
        want = "$0 API cost (runs on this machine)"
        assert want in render_run_card(tmp_path / "agree.json", rp)
        from mt_eval_harness.dashboard import _load_one
        assert _load_one(str(rp))["cost_label"] == want
        from mt_eval_harness.queue_runner import _read_report_cost_label
        assert _read_report_cost_label(rp) == want
        card, _, _ = assemble_run_card(rp)
        assert card["totals"]["cost_label"] == want


# ---------------------------------------------------------------------------
# 4. Nothing installs a package but `mt-eval setup` (or the user's pip)
# ---------------------------------------------------------------------------

def _forbid_installs(monkeypatch):
    from mt_eval_harness import setup_wizard

    def boom(*a, **k):
        raise AssertionError("a package install was attempted outside setup")
    monkeypatch.setattr(setup_wizard, "_pip_install", boom)
    monkeypatch.setattr(setup_wizard, "install_lang", boom)
    monkeypatch.setattr(setup_wizard, "pip_install_command", boom)


class TestNoInstallOutsideSetup:

    def _pack(self, monkeypatch, pack, metrics=None, standard=None):
        from mt_eval_harness import language_cards as lc
        monkeypatch.setattr(lc, "get_eval_pack", lambda code: pack)
        monkeypatch.setattr(lc, "get_name", lambda code: "Testish")
        monkeypatch.setattr(lc, "get_eval_metrics", lambda code: metrics)
        monkeypatch.setattr(lc, "get_eval_standard", lambda code: standard)

    def test_gate_stops_with_the_command_even_with_consent(self, monkeypatch):
        from mt_eval_harness.config import _check_eval_pack
        _forbid_installs(monkeypatch)
        self._pack(monkeypatch, {"pythonDeps": {"zz_missing_xyz": "zz>=1"},
                                 "requiresFst": False})
        monkeypatch.setenv("CI", "true")
        monkeypatch.setenv("MT_EVAL_AUTO_SETUP", "1")
        with pytest.raises(RuntimeError) as exc:
            _check_eval_pack({"id": "c", "language_pair": {"target": "tst"}},
                             assume_yes=True)
        text = str(exc.value)
        assert "mt-eval setup --lang tst" in text
        assert "installs nothing" in text

    def test_skip_fst_runs_without_the_fst(self, monkeypatch):
        from mt_eval_harness.config import _check_eval_pack
        from mt_eval_harness.plugins import fst_installer
        _forbid_installs(monkeypatch)
        self._pack(monkeypatch, {"pythonDeps": {"pyhfst": "zz_pyhfst_absent>=1"},
                                 "requiresFst": True})
        monkeypatch.setitem(sys.modules, "pyhfst", None)
        monkeypatch.setattr(fst_installer, "is_fst_installed", lambda c: False)
        monkeypatch.setattr("mt_eval_harness.setup_wizard.split_eval_pack",
                            lambda code, pack: {"pythonDeps": pack["pythonDeps"],
                                                "postInstall": [], "deferred": []})
        entry = {"id": "c", "language_pair": {"target": "tst"}}
        # Round 8: a missing FST lane no longer stops the run — it is an
        # advisory naming the install command and the re-score; --skip-fst
        # leaves it out without the notice. Nothing is installed either way.
        import io, contextlib
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            _check_eval_pack(entry)              # must not raise
        text = buf.getvalue()
        assert "proceeds WITHOUT FST scoring" in text
        assert "mt-eval setup --lang tst" in text and "--skip-fst" in text
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            _check_eval_pack(entry, skip_fst=True)   # must not raise
        assert "FST" not in buf.getvalue()

    def test_missing_eval_standard_is_named_not_installed(self, monkeypatch):
        from mt_eval_harness.config import _check_eval_pack
        _forbid_installs(monkeypatch)
        self._pack(monkeypatch, None,
                   metrics={"zz-m": {"module": "zz_absent_std.metrics",
                                     "class": "M"}},
                   standard={"package": "zz-std", "pip": "zz-std>=1,<2",
                             "import": "zz_absent_std"})
        entry = {"id": "c", "language_pair": {"target": "tst"}}
        # An eval standard is an optional add-on: a missing one never blocks
        # the run (its metrics are marked not computed) — the install command
        # is named, and nothing is installed.
        import io, contextlib
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            _check_eval_pack(entry)
        text = buf.getvalue()
        assert "pip install 'zz-std>=1,<2'" in text
        assert "not computed" in text
        _check_eval_pack(entry, skip_eval_standard=True)
        _check_eval_pack(entry, card_metrics_withheld=True)

    def test_a_missing_eval_standard_scores_without_it(self, monkeypatch, capsys):
        """discover_metric_plugins goes ahead without a missing eval-standard
        package (marked not computed, install command printed) instead of
        stopping the run."""
        from mt_eval_harness import plugin_discovery as pd
        monkeypatch.setattr(pd, "_load_language_card_metrics",
                            lambda code: (_ for _ in ()).throw(
                                pd.EvalStandardMissing("tst: pip install 'zz-std'")))
        monkeypatch.setattr(pd, "_skipped_language_card_metrics",
                            lambda code, why: [("skipped", why)])
        monkeypatch.setattr(pd, "_remote_lookup_refusal", lambda cfg: None)
        plugins = pd.discover_metric_plugins(
            {"target_lang": "Test", "target_lang_code": "tst"}, skip_fst=True)
        assert ("skipped", "its optional eval-standard package is not installed "
                "(the command above adds it)") in plugins
        assert "pip install 'zz-std'" in capsys.readouterr().out

    def test_scoring_never_installs_the_eval_standard(self, monkeypatch):
        from mt_eval_harness.plugin_discovery import (
            EvalStandardMissing, _ensure_eval_standard_installed)
        _forbid_installs(monkeypatch)
        monkeypatch.setattr(sys.stdin, "isatty", lambda: False)
        with pytest.raises(EvalStandardMissing) as exc:
            _ensure_eval_standard_installed(
                {"m": {"module": "zz_absent_std.metrics"}},
                {"package": "zz-std", "pip": "zz-std>=1",
                 "ipNotice": "Community-owned terms apply."}, "tst")
        text = str(exc.value)
        assert "pip install 'zz-std>=1'" in text
        assert "installs nothing" in text
        assert "Community-owned terms apply." in text

    def test_skip_flags_mark_metrics_not_computed(self, monkeypatch):
        from mt_eval_harness import language_cards as lc
        from mt_eval_harness import plugin_discovery as pd
        from mt_eval_harness.publish import _build_metric_availability
        monkeypatch.setattr(pd, "_detect_lang_code", lambda c: "tst")
        monkeypatch.setattr(pd, "_detect_lang_name", lambda c: "Testish")
        monkeypatch.setattr(lc, "get_fst_install_info",
                            lambda c: {"format": "giellalt-nightly-apt"})
        monkeypatch.setattr(lc, "get_eval_metrics",
                            lambda c: {"zz-eq": {"module": "zz.m", "class": "M"}})
        monkeypatch.setattr(pd, "_remote_lookup_refusal", lambda c: None)
        monkeypatch.setattr(pd, "_generic_plugins", lambda c: [])
        plugins = pd.discover_metric_plugins(
            {"skip_fst": True, "skip_eval_standard": True}, skip_fst=True)
        aggs = {p.name: p.aggregate([]) for p in plugins}
        assert "--skip-fst" in aggs["giellalt_fst_validity"]["error"]
        assert "--skip-eval-standard" in aggs["zz-eq"]["unavailable"]
        avail = _build_metric_availability(
            scores={}, plugin_metrics=aggs, has_fst=False, morph_accuracy=None,
            morph_coverage=None, morph_floor=0.5, has_glossary=False,
            has_references=True, metricx_requested=False)
        assert avail["fst_acceptance_rate"].startswith(
            "unavailable: not computed: the run was scored with --skip-fst")

    def test_fst_download_needs_a_person(self, monkeypatch, capsys):
        from mt_eval_harness.plugins import fst_installer
        monkeypatch.setattr(fst_installer.sys.stdin, "isatty", lambda: False)
        assert fst_installer.prompt_fst_install("crk", "Plains Cree") is False
        out = capsys.readouterr().out
        assert "mt-eval setup --lang crk" in out and "--skip-fst" in out

    def test_comet_is_never_offered_mid_run(self, monkeypatch, capsys):
        from mt_eval_harness import setup_wizard
        _forbid_installs(monkeypatch)
        monkeypatch.setattr(setup_wizard.sys.stdin, "isatty", lambda: True)
        monkeypatch.setattr("builtins.input", lambda *a: pytest.fail("asked"))
        # the not-installed case on an interpreter COMET supports (this test
        # also runs on 3.14, where the reason is the interpreter instead)
        from mt_eval_harness import metrics_comet
        monkeypatch.setattr(metrics_comet, "HAS_COMET", False)
        monkeypatch.setattr(metrics_comet, "comet_python_blocker", lambda: None)
        monkeypatch.setattr(metrics_comet, "COMET_IMPORT_ERROR",
                            "ModuleNotFoundError: No module named 'comet'")
        assert setup_wizard.prompt_comet_install() is False
        out = capsys.readouterr().out
        assert "mt-eval setup --comet" in out
        assert out.lstrip().startswith("⚠ COMET: not computed")

    def test_metric_dependencies_print_the_command(self, monkeypatch, capsys):
        from mt_eval_harness.plugin_discovery import _check_metric_dependencies
        _forbid_installs(monkeypatch)
        monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
        monkeypatch.setattr("builtins.input", lambda *a: pytest.fail("asked"))
        assert _check_metric_dependencies(
            {"dependencies": ["zz_absent_dep>=1"]}, "zz") is False
        assert "pip install 'zz_absent_dep>=1'" in capsys.readouterr().out

    def test_no_install_call_outside_setup(self):
        """Every pip/ensurepip/uv install lives in setup_wizard.py. (The node
        bundle's `pip wheel` downloads wheels into a bundle directory on the
        organizer's explicit command — it installs nothing.)"""
        needles = ("pip_install_command(", "_pip_install(", '"ensurepip"',
                   '"pip", "install"', "'pip', 'install'")
        for f in PKG.rglob("*.py"):
            if f.name == "setup_wizard.py":
                continue
            text = f.read_text(encoding="utf-8")
            for n in needles:
                assert n not in text, f"{f.relative_to(PKG)} calls {n}"

    def test_run_flags_reach_the_config(self):
        from mt_eval_harness.cli import args_to_config, build_parser
        args = build_parser().parse_args(
            ["run", "--corpus", "x.json", "--target-lang", "Plains Cree",
             "--skip-fst", "--skip-eval-standard", "--yes"])
        cfg = args_to_config(args)
        assert cfg.skip_fst is True and cfg.skip_eval_standard is True
        assert cfg.assume_yes is True

    def test_queue_hint_is_the_setup_command(self):
        from mt_eval_harness.queue_runner import _extract_error_hint
        out = ("\n  EVAL PACK REQUIRED: Plains Cree (crk)\n  Missing:\n"
               "    ✗ pyhfst>=1.4 (pyhfst)\n  Install them:\n"
               "    mt-eval setup --lang crk\n")
        hint = _extract_error_hint(out)
        assert "mt-eval setup --lang crk" in hint
        assert "installs nothing" in hint


# ---------------------------------------------------------------------------
# 5. contest validate writes no receipt
# ---------------------------------------------------------------------------

class TestValidateWritesNoReceipt:

    def _fixtures(self):
        from test_contest_validate import (DEV_CORPUS, EXAMPLE, QUALIFIER_ID,
                                           _manifest)
        from test_sandbox_runner import toy_translate
        return DEV_CORPUS, EXAMPLE, QUALIFIER_ID, _manifest, toy_translate

    def _hyps(self, tmp_path, name, translate):
        dev, *_ = self._fixtures()
        entries = json.loads(dev.read_text(encoding="utf-8"))["entries"]
        p = tmp_path / name
        p.write_text("\n".join(translate(e["source"]) for e in entries) + "\n",
                     encoding="utf-8")
        return p

    def test_validate_checks_the_existing_receipt(self, tmp_path):
        from mt_eval_harness import contest_validate as cv
        from mt_eval_harness.contest_qualify import qualify
        dev, example, qid, manifest, toy = self._fixtures()
        hyps = self._hyps(tmp_path, "dev.txt", toy)
        receipts = tmp_path / "receipts"
        offline = {"qualifier_id": qid, "threshold": 35.0,
                   "corpus_card_id": json.loads(dev.read_text())["dataset"]
                   ["corpus_id"], "language_pair": "qaa>qab"}
        with contextlib.redirect_stdout(io.StringIO()):
            qualify("synth", dev_hyp_path=hyps, dev_corpus_path=dev,
                    system_label="toy-lex", method_class="pipeline",
                    receipt_dir=receipts, offline_qualifier=offline)
        before = sorted(p.name for p in (receipts / "synth").rglob("*.json"))
        mp = tmp_path / "manifest.json"
        mp.write_text(json.dumps(manifest()), encoding="utf-8")
        with contextlib.redirect_stdout(io.StringIO()):
            result = cv.validate(
                example, manifest_path=mp, work_dir=tmp_path / "w",
                contest_id="synth", dev_hyp_path=hyps, dev_corpus_path=dev,
                qualifier_id=qid, threshold=35.0, receipt_dir=receipts)
        after = sorted(p.name for p in (receipts / "synth").rglob("*.json"))
        assert after == before, "validate minted or moved a receipt"
        assert not (receipts / "synth" / "history").exists()
        found = [f for f in result["findings"]
                 if f["check"] == "qualifier receipt"]
        assert found and found[0]["severity"] == "INFO"
        assert "matches your receipt for system 'toy-lex'" in found[0]["detail"]

    def test_different_hypotheses_than_the_receipt_warn(self, tmp_path):
        from mt_eval_harness import contest_validate as cv
        from mt_eval_harness.contest_qualify import qualify
        dev, example, qid, manifest, toy = self._fixtures()
        good = self._hyps(tmp_path, "dev.txt", toy)
        changed = self._hyps(tmp_path, "dev2.txt", lambda s: toy(s) + " .")
        receipts = tmp_path / "receipts"
        offline = {"qualifier_id": qid, "threshold": 1.0,
                   "corpus_card_id": json.loads(dev.read_text())["dataset"]
                   ["corpus_id"], "language_pair": "qaa>qab"}
        with contextlib.redirect_stdout(io.StringIO()):
            qualify("synth", dev_hyp_path=good, dev_corpus_path=dev,
                    system_label="toy-lex", method_class="pipeline",
                    receipt_dir=receipts, offline_qualifier=offline)
        mp = tmp_path / "manifest.json"
        mp.write_text(json.dumps(manifest()), encoding="utf-8")
        with contextlib.redirect_stdout(io.StringIO()):
            result = cv.validate(
                example, manifest_path=mp, work_dir=tmp_path / "w",
                contest_id="synth", dev_hyp_path=changed, dev_corpus_path=dev,
                qualifier_id=qid, threshold=1.0, receipt_dir=receipts,
                system_label="toy-lex")
        warns = [f["detail"] for f in result["warns"]]
        assert any("covers different dev hypotheses" in w for w in warns)
        assert len(list((receipts / "synth").glob("*.json"))) == 1

    def test_no_receipt_is_a_warning_and_nothing_is_written(self, tmp_path):
        from mt_eval_harness import contest_validate as cv
        dev, example, qid, manifest, toy = self._fixtures()
        hyps = self._hyps(tmp_path, "dev.txt", toy)
        mp = tmp_path / "manifest.json"
        mp.write_text(json.dumps(manifest()), encoding="utf-8")
        with contextlib.redirect_stdout(io.StringIO()):
            result = cv.validate(
                example, manifest_path=mp, work_dir=tmp_path / "w",
                contest_id="synth", dev_hyp_path=hyps, dev_corpus_path=dev,
                qualifier_id=qid, threshold=35.0,
                receipt_dir=tmp_path / "receipts")
        assert result["ok"] is True
        assert any(f["check"] == "qualifier receipt" for f in result["warns"])
        assert not (tmp_path / "receipts").exists()


# ---------------------------------------------------------------------------
# 6. Which parameter count is checked
# ---------------------------------------------------------------------------

class TestParameterCount:

    def test_mismatch_names_the_safetensors_count_and_the_fix(self, tmp_path):
        from test_contest_declarations import declarative_manifest
        from mt_eval_harness.contest_declarations import constraints_findings
        tensors = {"w": ("F32", [300, 300]), "b": ("F32", [300])}
        stored = 300 * 300 + 300
        m = declarative_manifest(tmp_path, tensors, 100_544)
        (finding,) = constraints_findings(m, bundle_dir=tmp_path)
        assert finding["severity"] == "BLOCK"
        text = finding["detail"]
        assert f"{stored:,} parameters stored in" in text
        assert "safetensors header" in text
        assert "tied or shared weight is stored once" in text
        assert f"Declare --parameter-count {stored}" in text

    def test_help_says_which_count(self):
        from mt_eval_harness.cli import build_parser
        parser = build_parser()
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf), pytest.raises(SystemExit):
            parser.parse_args(["contest", "submit-model", "--help"])
        helptext = " ".join(buf.getvalue().split())
        assert "safetensors header" in helptext
        assert "sum(p.numel()" in helptext


# ---------------------------------------------------------------------------
# 7. The MDE where the organizer decides
# ---------------------------------------------------------------------------

class TestPowerBeforeRegistration:

    def test_line_is_labelled(self):
        from mt_eval_harness.power import declared_power_line
        line = declared_power_line({
            "n_segments": 25, "metric": "chrf_plus_plus", "target_power": 0.8,
            "alpha": 0.05, "minimum_detectable_effect": 12.3,
            "parameters": {"basis": "two pilot systems on the public dev set, n=25"}})
        assert line.startswith("Sealed-test power: n=25 segments;")
        assert "minimum detectable effect (MDE) 12.3 chrF++ at 80% power" in line
        none = declared_power_line({"n_segments": 25, "metric": "chrf_plus_plus",
                                    "minimum_detectable_effect": None,
                                    "note": "fit two systems (--power-pilot)"})
        assert "MDE) not stated for chrF++ — fit two systems" in none

    def _pilot(self, path, outputs):
        entries = [{"id": str(i), "expected": f"ref words {i} here",
                    "predicted": o} for i, o in enumerate(outputs)]
        path.write_text(json.dumps({"entries": entries}), encoding="utf-8")
        return path

    def test_prepare_no_register_prints_it_and_records_absolute_pilots(
            self, tmp_path, capsys, monkeypatch):
        from mt_eval_harness.cli import main
        from test_contest_prep import MASTER
        a = self._pilot(tmp_path / "a.json",
                        [f"ref words {i} here" for i in range(6)])
        b = self._pilot(tmp_path / "b.json",
                        [f"ref {i}" for i in range(6)])
        monkeypatch.chdir(tmp_path)
        out = tmp_path / "o"
        argv = ["mt-eval", "contest", "prepare", "--corpus", str(MASTER),
                "--slug", "s", "--name", "N", "--pair", "qaa>qab",
                "--dev-size", "3", "--blind-size", "2", "--seed", "7",
                "--qualifier-threshold", "35", "--plaintext-refs",
                "--authorization-model", "blanket", "--license", "CC-BY-4.0",
                "--power-pilot", "a.json", "b.json",
                "--no-register", "--out", str(out)]
        with patch.object(sys, "argv", argv):
            try:
                main()
            except SystemExit as e:
                assert not e.code, capsys.readouterr()
        text = capsys.readouterr().out
        # a blind-only preparation has no sealed test: it says so, here
        assert "Sealed-test power: not stated" in text
        manifest = json.loads((out / "local" / "manifest.json").read_text())
        pilots = manifest["registration"]["power_pilot"]
        assert pilots == [str(a.resolve()), str(b.resolve())]

    def test_preview_states_the_mde_from_the_pilot(self, tmp_path):
        from mt_eval_harness.cli import _power_preview
        a = self._pilot(tmp_path / "a.json",
                        [f"ref words {i} here" for i in range(6)])
        b = self._pilot(tmp_path / "b.json", [f"ref {i}" for i in range(6)])
        line = _power_preview({"sizes": {"secret": 40}}, "chrf_plus_plus",
                              [str(a), str(b)])
        assert line.startswith("Sealed-test power: n=40 segments;")
        assert "minimum detectable effect (MDE)" in line
        assert "chrF++" in line
        no_pilot = _power_preview({"sizes": {"secret": 40}}, None, None)
        assert "not stated for chrF++" in no_pilot
        assert "--power-pilot" in no_pilot
        bad = _power_preview({"sizes": {"secret": 40}}, None, [str(a)])
        assert "✗ not computed" in bad


# ---------------------------------------------------------------------------
# 8. corpora --target alone
# ---------------------------------------------------------------------------

class TestCorporaOneSide:

    def _run(self, **kw):
        from mt_eval_harness.cli import cmd_corpora
        args = SimpleNamespace(**{"source": None, "target": None,
                                  "list_sources": False, "json": False,
                                  "include_quarantined": False, **kw})
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            code = cmd_corpora(args)
        return code, buf.getvalue()

    def test_target_alone_lists_corpora_from_any_source(self):
        code, out = self._run(target="sme", json=True)
        assert code == 0
        d = json.loads(out)
        assert d["source"] is None and d["target"] == "sme"
        assert d["count"] >= 1
        assert all(c["target"] == "sme" for c in d["corpora"])
        code, table = self._run(target="sme")
        assert code == 0 and "into Northern S" in table and "eng>sme" in table

    def test_source_alone_lists_corpora_and_still_names_targets(self):
        code, out = self._run(source="eng", json=True)
        d = json.loads(out)
        assert code == 0 and d["count"] > 0
        assert all(c["source"] == "eng" for c in d["corpora"])
        assert "targets" in d and "quarantined_only_targets" in d

    def test_neither_is_still_a_clear_error(self):
        code, out = self._run(json=True)
        assert code == 2 and "and/or" in json.loads(out)["message"]
