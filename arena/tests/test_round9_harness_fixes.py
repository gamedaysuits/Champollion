"""Round 9 synthetic users (researcher eng→sme, hospital persona, school),
2026-10-04 — the harness side.

1. `mt-eval card <log>` (and the card `test -o <path>` prints) showed
   "chrF++ 0.0 / BLEU 0.0" when the report was not `<log>_report.json`,
   without saying no report had been found (real scores 8.2 / 0.5).
2. A glossary given to `mt-eval test --glossary` left no trace in the report
   (compare: "Glossary —") while it changed the composite (terminology
   entered it). Recorded, and said beside every composite it changes.
3. `total_cost_usd: null` + `cost_unknown: true` beside cost_label "$0 API
   cost (runs on this machine)".
4. `contest qualify --dev <run log>`: "Hypothesis for id 'config' is not a
   string".
5. `node init --from-contest` left the test-suite path as a placeholder.
7. "founder review pending" reached users.
9/10. A private-use code (qaa) is not a lookup failure; the unresolved-name
   warning suggested the concrete code 'abc'.
13. compare printed nothing for a plugin recorded as not computed.
14. No way to tell the model which script (Plains Cree: Cans / Latn).
15. A contamination grade of UNCHECKED (register-corpus offline).
"""

from __future__ import annotations

import contextlib
import io
import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

from mt_eval_harness import publish
from mt_eval_harness.tester import analyze_run, analyze_run_log

ROWS = [
    ("Where does it hurt?", "Gos bávččas dutnje dál?"),
    ("Take this medicine twice a day.", "Váldde dán dálkkasa guktii beaivvis."),
    ("The doctor is coming soon.", "Doavttir boahtá fargga dása."),
    ("Please sit down here.", "Čohkkán dása, leat buorre."),
]
OUTPUTS = ["Gos bávččas dál?", "Váldde dálkkasa guktii.", "Doavttir boahtá.",
           "Čohkkán dása."]


@pytest.fixture(autouse=True)
def _no_git(monkeypatch):
    monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)
    monkeypatch.setattr(publish, "_is_prod_target", lambda: False)


def _run_log(name="run_r9", *, provider="local", locality="loopback",
             cost=None, total=None, errors=()):
    results = [{"id": f"e{i}", "source": s, "expected": r, "predicted": o,
                "raw_predicted": o, "latency_s": 0.1, "cost_usd": cost,
                "cached": False, "error": ("boom" if i in errors else None)}
               for i, ((s, r), o) in enumerate(zip(ROWS, OUTPUTS))]
    prov = {"corpus_sha256": "c" * 64}
    if locality:
        prov["endpoint_locality"] = locality
    return {
        "run_id": name, "harness_version": "0.2.0",
        "timestamp_start": "2026-10-04T00:00:00Z", "elapsed_s": 1.0,
        "total_cost_usd": total, "cache_hits": 0,
        "config": {"model": "llama3.1", "prompt_version": "naive",
                   "temperature": 0.0, "batch_size": 1, "max_tokens": 256,
                   "dataset_id": "round9-test", "source_lang": "English",
                   "target_lang": "French", "provider": provider},
        "provenance": prov,
        "results": results,
    }


def _quiet(fn, *a, **kw):
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*a, **kw)


def _write_log(tmp_path, log):
    p = tmp_path / f"{log['run_id']}.json"
    p.write_text(json.dumps(log), encoding="utf-8")
    return p


def _terminology(glossary):
    from mt_eval_harness.plugins.terminology import TerminologyPlugin
    return TerminologyPlugin(glossary=glossary)


# ---------------------------------------------------------------------------
# 1. The card finds the report the run recorded — or says it found none
# ---------------------------------------------------------------------------

class TestCardFindsItsReport:

    def test_test_o_records_the_path_and_card_reads_it(self, tmp_path):
        from mt_eval_harness.run_card import REPORT_PATHS_KEY, render_run_card
        log = _write_log(tmp_path, _run_log())
        custom = tmp_path / "elsewhere" / "scores.json"
        custom.parent.mkdir()
        report = _quiet(analyze_run, log, str(custom), compute_ci=False)
        assert json.loads(log.read_text())[REPORT_PATHS_KEY] == [
            str(custom.resolve())]
        card = render_run_card(log)
        chrf = report["overall"]["corpus_chrf"]
        assert f"chrF++ (corpus)        {chrf:.1f}" in card
        assert "Report file            scores.json" in card
        assert "NOT SCORED" not in card

    def test_no_report_says_so_and_prints_no_zero_scores(self, tmp_path):
        from mt_eval_harness.run_card import render_run_card
        log = _write_log(tmp_path, _run_log())
        card = render_run_card(log)
        assert "NOT SCORED — no report found for this run log" in card
        assert "run_r9_report.json" in card and "mt-eval test" in card
        assert "chrF++ (corpus)" not in card
        assert "BLEU (corpus)" not in card
        assert "Exact match" not in card
        assert "Report file            none found" in card

    def test_a_named_report_of_another_run_is_refused(self, tmp_path):
        from mt_eval_harness.run_card import ReportPairingError, render_run_card
        log = _write_log(tmp_path, _run_log())
        other = tmp_path / "other_report.json"
        _quiet(analyze_run_log, _run_log("run_other"), output_path=other,
               compute_ci=False)
        with pytest.raises(ReportPairingError, match="another|not of"):
            render_run_card(log, other)

    def test_card_cli_takes_report_and_a_report_file(self, tmp_path, capsys):
        from mt_eval_harness.cli import main
        log = _write_log(tmp_path, _run_log())
        custom = tmp_path / "scores.json"
        _quiet(analyze_run_log, json.loads(log.read_text()),
               output_path=custom, compute_ci=False,
               source_log_path=str(log.resolve()))
        # the log never recorded it (written through the in-memory API)
        with patch.object(sys, "argv", ["mt-eval", "card", str(log),
                                        "--report", str(custom)]):
            main()
        assert "Report file            scores.json" in capsys.readouterr().out
        # the report file itself: read with the run log it records
        with patch.object(sys, "argv", ["mt-eval", "card", str(custom)]):
            main()
        out = capsys.readouterr().out
        assert "chrF++ (corpus)" in out and "Log file               run_r9.json" in out

    def test_a_named_report_never_written_reads_as_not_scored(self, tmp_path,
                                                              capsys):
        """The run's own end-of-run card after a failed analysis."""
        from mt_eval_harness.cli import main
        from mt_eval_harness.run_card import render_run_card
        log = _write_log(tmp_path, _run_log())
        card = render_run_card(log, tmp_path / "run_r9_report.json")
        assert "NOT SCORED" in card and "chrF++ (corpus)" not in card
        with patch.object(sys, "argv", ["mt-eval", "card", str(log),
                                        "--report", str(tmp_path / "x.json")]):
            with pytest.raises(SystemExit) as exc:
                main()
        assert exc.value.code == 1
        assert "--report" in capsys.readouterr().err

    def test_compare_finds_a_recorded_report_from_the_log(self, tmp_path):
        from mt_eval_harness.compare import run_compare
        log_a = _write_log(tmp_path, _run_log("run_a"))
        log_b = _write_log(tmp_path, _run_log("run_b"))
        _quiet(analyze_run, log_a, str(tmp_path / "a_scores.json"),
               compute_ci=False)
        _quiet(analyze_run, log_b, None, compute_ci=False)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            run_compare([str(log_a), str(log_b)],
                        output_path=str(tmp_path / "cmp.json"))
        assert "Need at least 2 reports" not in out.getvalue()
        assert (tmp_path / "cmp.json").is_file()


# ---------------------------------------------------------------------------
# 2. A test-time glossary is recorded, and said beside the composite
# ---------------------------------------------------------------------------

class TestGlossaryRecorded:

    def _two_reports(self, tmp_path):
        gloss = tmp_path / "gloss.json"
        gloss.write_text(json.dumps({"dictionary": {"doctor": "doavttir"}}),
                         encoding="utf-8")
        log = _write_log(tmp_path, _run_log())
        plain = tmp_path / "plain_report.json"
        with_g = tmp_path / "gloss_report.json"
        _quiet(analyze_run, log, str(plain), compute_ci=False,
               metric_plugins=[_terminology(None)])
        _quiet(analyze_run, log, str(with_g), compute_ci=False,
               metric_plugins=[_terminology({"doctor": ["doavttir"]})],
               glossary_file=str(gloss))
        return gloss, plain, with_g

    def test_report_records_name_and_sha_never_content(self, tmp_path):
        import hashlib
        gloss, plain, with_g = self._two_reports(tmp_path)
        rec = json.loads(with_g.read_text())["glossary"]
        assert rec == {"file": "gloss.json",
                       "sha256": hashlib.sha256(gloss.read_bytes()).hexdigest(),
                       "terms": 1, "given_at": "mt-eval test --glossary"}
        assert "glossary" not in json.loads(plain.read_text())
        # Scoring standard/1: no published composite for a glossary to change.
        assert "published_composite" not in json.loads(with_g.read_text())["overall"]

    def test_compare_names_the_glossary_and_says_composites_differ(
            self, tmp_path):
        from mt_eval_harness.compare import (compare_reports,
                                             format_comparison_table)
        _g, plain, with_g = self._two_reports(tmp_path)
        cmp = _quiet(compare_reports, [plain, with_g])
        rows = cmp["overall_comparison"]
        assert rows[0]["glossary"] is None
        assert rows[1]["glossary"].startswith("gloss.json (")
        # Scoring standard/1: no composite in the comparison at all.
        assert "composite" not in rows[1]
        table = format_comparison_table(rows)
        assert "Composite" not in table
        flat = " ".join(table.split())   # the note wraps at 78 columns
        # What a glossary still changes is the terminology DIAGNOSTIC.
        assert ("Glossaries differ — terminology adherence (a diagnostic) is "
                "comparable only between runs scored with the same glossary: "
                "B gloss.json (") in flat
        assert "A none" in flat
        assert "It never enters the chrF++ decision." in flat

    def test_publish_preview_says_it(self, tmp_path, capsys):
        # The terminology DIAGNOSTIC names the glossary that scored it (the
        # composite it used to reweight is retired).
        _g, _plain, with_g = self._two_reports(tmp_path)
        publish.publish_to_supabase(str(with_g), dry_run=True, anonymous=True)
        out = capsys.readouterr().out
        line = next(l for l in out.splitlines() if "Terminology:" in l)
        assert "gloss.json" in line
        assert "Composite includes" not in out

    def test_note_helper_is_silent_without_terminology(self):
        assert publish.glossary_composite_note({"A": False, "B": False},
                                               {}) is None
        assert publish.composite_uses("terminology_adherence",
                                      {"terminology_adherence": 0.5},
                                      "surface-only") is True
        assert publish.composite_uses("terminology_adherence",
                                      {"terminology_adherence": None},
                                      "surface-only") is False


# ---------------------------------------------------------------------------
# 3. A run that verifiably made no API call is not of unknown cost
# ---------------------------------------------------------------------------

class TestCostFieldsAgree:

    def _overall(self, tmp_path, **kw):
        report = _quiet(analyze_run_log, _run_log(**kw),
                        output_path=tmp_path / "r_report.json",
                        compute_ci=False)
        return report["overall"]

    def test_loopback_local_is_zero_api_cost_not_unknown(self, tmp_path):
        o = self._overall(tmp_path)
        assert o["total_cost_usd"] is None
        assert o["cost_unknown"] is False and o["api_cost_usd"] == 0.0
        assert o["cost_label"] == "$0 API cost (runs on this machine)"

    def test_in_process_is_local_too(self, tmp_path):
        o = self._overall(tmp_path, provider="method-plugin",
                          locality="in-process")
        assert o["cost_unknown"] is False and o["api_cost_usd"] == 0.0

    def test_unpriced_remote_stays_unknown(self, tmp_path):
        o = self._overall(tmp_path, provider="openrouter", locality=None)
        assert o["total_cost_usd"] is None
        assert o["cost_unknown"] is True and o["api_cost_usd"] is None
        assert o["cost_label"].startswith("unknown")

    def test_priced_run_api_cost_is_the_total(self, tmp_path):
        o = self._overall(tmp_path, provider="openrouter", locality=None,
                          cost=0.001, total=0.004)
        assert o["api_cost_usd"] == o["total_cost_usd"] == 0.004
        assert "cost_unknown" not in o

    def test_run_total_cost_still_reads_null(self, tmp_path):
        from mt_eval_harness.run_card import run_total_cost
        report = _quiet(analyze_run_log, _run_log(),
                        output_path=tmp_path / "r_report.json",
                        compute_ci=False)
        assert run_total_cost(None, report) is None


# ---------------------------------------------------------------------------
# 4. contest qualify --dev takes a harness run log
# ---------------------------------------------------------------------------

def _dev_corpus(tmp_path):
    p = tmp_path / "dev.json"
    p.write_text(json.dumps({
        "dataset": {"corpus_id": "dev", "language_pair": {"source": "eng",
                                                          "target": "sme"}},
        "entries": [{"id": f"e{i}", "source": s, "reference": r}
                    for i, (s, r) in enumerate(ROWS)]}), encoding="utf-8")
    return p


def _corpus_entries(path):
    from mt_eval_harness.config import RunConfig
    from mt_eval_harness.corpus_loader import load_corpus
    entries, _ = load_corpus(RunConfig(corpus_path=str(path)))
    return entries


class TestHypothesesFromARunLog:

    def test_a_run_log_is_read_by_entry_id(self, tmp_path):
        from mt_eval_harness.external_scoring import (align_hypotheses,
                                                      load_hypotheses)
        log = _write_log(tmp_path, _run_log())
        hyps = load_hypotheses(log)
        assert dict(hyps) == {f"e{i}": o for i, o in enumerate(OUTPUTS)}
        assert align_hypotheses(_corpus_entries(_dev_corpus(tmp_path)),
                                hyps) == OUTPUTS

    def test_its_report_too(self, tmp_path):
        from mt_eval_harness.external_scoring import load_hypotheses
        rp = tmp_path / "r_report.json"
        _quiet(analyze_run_log, _run_log(), output_path=rp, compute_ci=False)
        assert list(load_hypotheses(rp).values()) == OUTPUTS

    def test_errored_entries_are_refused_with_the_reason(self, tmp_path):
        from mt_eval_harness.external_scoring import (HypothesesFormatError,
                                                      load_hypotheses)
        log = _write_log(tmp_path, _run_log(errors=(1,)))
        with pytest.raises(HypothesesFormatError,
                           match="1 errored entry .*'e1'.* every corpus entry is scored"):
            load_hypotheses(log)

    def test_a_run_on_another_corpus_is_refused(self, tmp_path):
        from mt_eval_harness.external_scoring import (HypothesesFormatError,
                                                      align_hypotheses,
                                                      load_hypotheses)
        other = _run_log()
        other["results"][2]["source"] = "Something else entirely."
        hyps = load_hypotheses(_write_log(tmp_path, other))
        with pytest.raises(HypothesesFormatError,
                           match="different source text .* 1 of 4 ids"):
            align_hypotheses(_corpus_entries(_dev_corpus(tmp_path)), hyps)

    def test_an_unknown_json_shape_names_the_accepted_ones(self, tmp_path):
        from mt_eval_harness.external_scoring import (HypothesesFormatError,
                                                      load_hypotheses)
        p = tmp_path / "x.json"
        p.write_text(json.dumps({"e0": "ok", "meta": {"a": 1}}))
        with pytest.raises(HypothesesFormatError) as exc:
            load_hypotheses(p)
        msg = str(exc.value)
        assert "not a translation string" in msg
        assert "the harness run log" in msg and "mt-eval run" in msg
        assert "is not a string (got" not in msg

    def test_qualify_scores_a_run_log(self, tmp_path):
        from mt_eval_harness.external_scoring import score_hypotheses
        res = _quiet(score_hypotheses, corpus_path=_dev_corpus(tmp_path),
                     hypotheses_path=_write_log(tmp_path, _run_log()),
                     dataset_id="dev", source_lang="eng", target_lang="sme",
                     system_label="s", method_class="pipeline",
                     output_dir=tmp_path / "o", compute_ci=False)
        report = json.loads(Path(res["report_path"]).read_text())
        assert report["overall"]["evaluated"] == 4


# ---------------------------------------------------------------------------
# 5. node init --from-contest fills the test-suite path prepare read
# ---------------------------------------------------------------------------

def _fake_seal(*, plaintext_path, card_id, artifact_out, card_block_out, **kw):
    Path(artifact_out).write_text("sealed", encoding="utf-8")
    block = {"keyScheme": "single-keypair-wave1", "thresholdKeyId": "k1"}
    Path(card_block_out).write_text(json.dumps(block), encoding="utf-8")
    return block


def _master(tmp_path, rows, name):
    p = tmp_path / name
    p.write_text(json.dumps({
        "dataset": {"corpus_id": name,
                    "language_pair": {"source": "qaa", "target": "qab"}},
        "entries": [{"id": i, "source": s, "reference": r}
                    for i, (s, r) in enumerate(rows)]}), encoding="utf-8")
    return p


class TestSuitePathCarriesToTheNode:

    def _prepare(self, tmp_path, monkeypatch):
        from mt_eval_harness import contest_prep as prep
        from mt_eval_harness.external_scoring import sha256_file
        monkeypatch.setattr(prep, "seal_file_via_cli", _fake_seal)
        suite = _master(tmp_path, [(f"s{i}", f"r{i}") for i in range(3)],
                        "suite.json")
        reg = tmp_path / "registry.json"
        reg.write_text(json.dumps({"registry_version": "t", "datasets": [{
            "id": "eval-qaa-qab-diag-v1",
            "language_pair": {"source": "qaa", "target": "qab"},
            "sha256": sha256_file(suite), "url": "https://example.test/d",
            "source": "Third Party", "license": "CC-BY-4.0"}]}),
            encoding="utf-8")
        master = _master(tmp_path, [(f"m{i}", f"n{i}") for i in range(20)],
                         "master.json")
        out = tmp_path / "contest"
        manifest = _quiet(
            prep.prepare_contest, master_corpus_path=master, slug="synth",
            name="Synthetic Open 2026", source_lang="qaa", target_lang="qab",
            dev_size=5, secret_size=10, holdout_size=0, seed=7,
            qualifier_threshold=35.0, license_id="CC-BY-4.0",
            custodian_group_id="cg", threshold_pubkey="unused.pub.json",
            out_dir=out, test_suites=[f"eval-qaa-qab-diag-v1={suite}"],
            registry_path=reg)
        return manifest, out, suite

    def test_prepare_records_the_copy_and_node_init_fills_it(
            self, tmp_path, monkeypatch):
        from mt_eval_harness.contest_node import node_config_from_contest
        from mt_eval_harness.contest_prep import contest_metadata_extra
        manifest, out, suite = self._prepare(tmp_path, monkeypatch)
        assert manifest["test_suite_local_copies"] == {
            "eval-qaa-qab-diag-v1": str(suite.resolve())}
        # never registered: the contest metadata carries no local path
        assert str(suite) not in json.dumps(contest_metadata_extra(manifest))
        text, notes = node_config_from_contest(out)
        (entry,) = json.loads(text)["contests"].values()
        (s,) = entry["test_suites"]
        assert s["corpus_path"] == str(suite.resolve())
        assert not any("point corpus_path" in n for n in notes)

    def test_a_copy_that_changed_is_not_filled(self, tmp_path, monkeypatch):
        from mt_eval_harness.contest_node import node_config_from_contest
        _m, out, suite = self._prepare(tmp_path, monkeypatch)
        suite.write_text("changed", encoding="utf-8")
        text, notes = node_config_from_contest(out)
        (entry,) = json.loads(text)["contests"].values()
        assert entry["test_suites"][0]["corpus_path"].startswith("<")
        assert any("no longer hashes to the pinned" in n for n in notes)


# ---------------------------------------------------------------------------
# 7. No internal review wording in what users read
# ---------------------------------------------------------------------------

def test_metric_reliability_note_is_user_facing():
    from mt_eval_harness.recommend import metric_reliability_evidence
    import inspect
    src = inspect.getsource(sys.modules[metric_reliability_evidence.__module__])
    assert "founder review pending" not in src
    assert "has not yet been reviewed" in src


# ---------------------------------------------------------------------------
# 9/10. Private-use codes, and no example code for an unresolved name
# ---------------------------------------------------------------------------

class TestPrivateUse:

    def test_is_private_use(self):
        from mt_eval_harness.language_cards import is_private_use
        assert is_private_use("qaa") and is_private_use("QTZ")
        assert not is_private_use("qua") and not is_private_use("crk")

    def test_unresolved_name_suggests_no_concrete_code(self):
        from mt_eval_harness.plugin_discovery import unresolved_target_message
        msg = unresolved_target_message(
            {"target_lang": "Ayta (variety not yet confirmed)"})
        assert "'abc'" not in msg
        assert "--target-lang-code <ISO 639-3 code>" in msg
        assert "qaa–qtz" in msg

    def test_eval_pack_line_names_the_language_and_why(self):
        from mt_eval_harness.config import eval_pack_lines
        (line,) = eval_pack_lines(
            {"status": "not_needed", "language": "qaa",
             "language_name": "qaa"}, blocks_run=True,
            language_label="Ayta (variety not yet confirmed)")
        assert line == ("EVAL PACK: none needed for Ayta (variety not yet "
                        "confirmed) (qaa) — an ISO 639-3 private-use code "
                        "(qaa–qtz): no language card exists for it, by "
                        "design")


# ---------------------------------------------------------------------------
# 13. compare says which plugin was not computed, and why
# ---------------------------------------------------------------------------

def _report_with_plugin(tmp_path, name, plugin_value):
    rp = tmp_path / f"{name}_report.json"
    _quiet(analyze_run_log, _run_log(name), output_path=rp, compute_ci=False)
    data = json.loads(rp.read_text())
    data["overall"].setdefault("plugin_metrics", {})[
        "giellalt_fst_validity"] = plugin_value
    rp.write_text(json.dumps(data))
    return rp


def test_compare_prints_a_not_computed_line(tmp_path):
    from mt_eval_harness.compare import compare_reports, format_comparison_table
    why = "not computed: the FST analyzer is not installed"
    a = _report_with_plugin(tmp_path, "run_a", {"error": why})
    b = _report_with_plugin(tmp_path, "run_b", {"unavailable": why})
    c = _report_with_plugin(tmp_path, "run_c",
                            {"avg_fst_validity": 0.5, "total_valid_words": 3})
    table = format_comparison_table(
        _quiet(compare_reports, [a, b, c])["overall_comparison"])
    assert sum("Not computed" in l for l in table.splitlines()) == 1
    flat = " ".join(table.split())       # wrapped at 78 columns
    assert ("Not computed — [giellalt_fst_validity] A, B: the FST analyzer "
            "is not installed") in flat
    assert "C:" not in flat.split("Not computed", 1)[1].split("Composite", 1)[0]


# ---------------------------------------------------------------------------
# 14. --target-script: validated against the card, asked for in the prompt
# ---------------------------------------------------------------------------

class TestTargetScript:

    def _cfg(self, **kw):
        from mt_eval_harness.config import RunConfig
        return RunConfig(target_lang="Plains Cree", target_lang_code="crk",
                         provider="local", model="llama3.1", **kw)

    def test_a_card_script_is_accepted_and_normalized(self):
        cfg = self._cfg(target_script="latn")
        assert cfg._target_script_errors() == []
        assert cfg.target_script == "Latn"

    def test_a_script_the_card_does_not_list_is_refused(self):
        (err,) = self._cfg(target_script="Arab")._target_script_errors()
        assert "lists Cans, Latn" in err

    def test_not_a_code_and_not_for_a_method(self):
        assert "not an ISO 15924" in self._cfg(
            target_script="syllabics")._target_script_errors()[0]
        (err,) = self._cfg(target_script="Cans",
                           mt_method="google-translate")._target_script_errors()
        assert "gets no prompt" in err

    def test_the_prompt_asks_for_it_and_the_note_asks_for_one(self):
        from mt_eval_harness.runner import load_system_prompt, script_choice_note
        prompt = load_system_prompt(self._cfg(target_script="Cans"))
        assert prompt.endswith("Write the translation in the Cans script "
                               "(ISO 15924 code Cans).")
        assert "Plains Cree" in prompt
        note = script_choice_note(self._cfg())
        assert "2 scripts per its card (Cans, Latn)" in note
        assert "--target-script <Cans|Latn>" in note
        assert script_choice_note(self._cfg(target_script="Cans")) is None
        assert "Write the translation" not in load_system_prompt(self._cfg())


# ---------------------------------------------------------------------------
# 15. UNCHECKED (register-corpus could not compare): relative-only, said so
# ---------------------------------------------------------------------------

def test_unchecked_grade_is_relative_only_and_explained():
    from mt_eval_harness import contamination as c
    assert c.is_relative_only("UNCHECKED")
    assert c.lane_for_grade("unchecked") == c.LANE_RELATIVE_ONLY
    notice = c.relative_only_notice("UNCHECKED", "eval-x",
                                    stated="UNCHECKED", source="the card")
    assert "never compared with the public corpora" in notice
    assert "--contamination" in notice
