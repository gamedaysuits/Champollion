"""Round 5 synthetic researcher (+ school persona) findings.

1. A method plugin's run card and fingerprint dropped the model it was given
   (`-m stub-1`) — the runner overwrote it with the method id before the
   plugin ran, so the plugin never saw it either — and the `dependencies` its
   method.json declares: one plugin on two models had ONE fingerprint.
2. The TestReport's only composite was the SEGMENT composite, stored as
   "composite_score" (0.15 beside a published 0.2987).
3. `node approve --offline` signed straight after import, before the node had
   re-executed the qualifier or checked a container runtime (tests in
   test_round4_researcher_fixes.TestOfflineApproval, which pin the order).
4. Copying the English source unchanged cleared the contest qualifier.
5. Qualifier receipts were one file per contest: a second system silently
   replaced the first.
6. `node init --from-contest` left prize_terms_sha256 for the organizer to
   find — the manifest never recorded the terms.
7. `contest qualify` printed "$0.0000" for outputs made outside the harness.
8. The leaderboard rules listed EdTeKLA (quarantined) as an available dataset.
9. (school persona) A coached run's local report never said what the model
   was told.
"""

from __future__ import annotations

import asyncio
import contextlib
import io
import json
import sys
from pathlib import Path

import pytest

from mt_eval_harness.config import RunConfig

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT.parent / "cli" / "website" / "docs" / "network"
FIXTURES = Path(__file__).parent / "fixtures" / "contest_synthetic"
DEV_CORPUS = FIXTURES / "corpus_dev.json"
CONTEST_ID = "synth-open-2026"
QUALIFIER_ID = "eval-qaa-qab-synth-qualifier-v2026"
QUALIFIER_CORPUS = "eval-qaa-qab-synth-dev-v1"


def _quiet(fn, *a, **kw):
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*a, **kw)


# ---------------------------------------------------------------------------
# 1. The model a plugin is given, and its dependencies
# ---------------------------------------------------------------------------

PLUGIN_SRC = '''
class EchoModel:
    def __init__(self, manifest=None, method_dir=None):
        pass

    async def translate(self, entries, config):
        m = config.method_model
        return [{"id": e["id"], "predicted": f"[{m}] " + e["source"],
                 "latency_s": 0.0, "usage": {}, "error": None,
                 "tool_calls": [], "tool_call_count": 0, "metadata": {}}
                for e in entries]
'''

DEPENDENCIES = [{
    "id": "llm-inference", "kind": "model", "license": "proprietary",
    "access": "gateway", "source": "openrouter:any", "substitutable": True,
    "redistributable": False, "transferable": False,
    "notes": "Any compatible chat-completions endpoint works."}]


def _plugin(tmp_path: Path, deps=DEPENDENCIES) -> Path:
    d = tmp_path / "plug"
    d.mkdir(exist_ok=True)
    manifest = {"name": "Echo", "method_id": "echo-model", "class": "pipeline",
                "entry_point": "echo:EchoModel", "version": "0.1.0",
                "dependency_class": "A1"}
    if deps is not None:
        manifest["dependencies"] = deps
    (d / "method.json").write_text(json.dumps(manifest))
    (d / "echo.py").write_text(PLUGIN_SRC)
    return d


def _corpus(tmp_path: Path) -> Path:
    c = tmp_path / "corpus.json"
    c.write_text(json.dumps({
        "dataset": {"language_pair": {"source": "eng", "target": "fra"}},
        "entries": [{"id": str(i), "source": f"hello friend {i}",
                     "reference": f"bonjour ami {i}"} for i in range(4)]}))
    return c


def _run(tmp_path: Path, name: str, **cfg):
    from mt_eval_harness.publish import assemble_run_card
    from mt_eval_harness.runner import execute_run
    out = tmp_path / name
    config = RunConfig(method_path=str(_plugin(tmp_path, cfg.pop("deps",
                                                                 DEPENDENCIES))),
                       corpus_path=str(_corpus(tmp_path)),
                       target_lang="French", output_dir=str(out),
                       cache_dir=str(tmp_path / f"cache-{name}"),
                       dataset="all", **cfg)
    log = _quiet(lambda: asyncio.run(execute_run(config)))
    report = next(out.glob("*_report.json"))
    card, _id, fp = _quiet(assemble_run_card, report)
    return log, card, fp, report


class TestPluginModelAndDependencies:
    def test_two_models_two_fingerprints_and_the_plugin_sees_its_model(
            self, tmp_path):
        log1, card1, fp1, _ = _run(tmp_path, "a", model="vendor/stub-1")
        log2, card2, fp2, _ = _run(tmp_path, "b", model="vendor/stub-2")
        # The plugin was handed the model (it used to see its own method id).
        assert log1["results"][0]["predicted"].startswith("[vendor/stub-1]")
        assert log1["config"]["method_model"] == "vendor/stub-1"
        assert log1["config"]["model"] == "echo-model"   # identity unchanged
        assert fp1 != fp2
        c1 = card1["fingerprint"]["components"]
        assert c1["method_model"] == "vendor/stub-1"
        assert card2["fingerprint"]["components"]["method_model"] == "vendor/stub-2"
        assert card1["model_slug"] == card2["model_slug"] == "echo-model"
        mp = card1["method_plugin"]
        assert mp["model_given"] == "vendor/stub-1"
        assert mp["dependency_class"] == "A1"
        assert mp["dependencies"][0]["id"] == "llm-inference"
        assert "notes" not in mp["dependencies"][0]      # identity, not prose
        assert c1["method_dependencies_sha256"] == mp["dependencies_sha256"]
        assert card1["method_config"]["model"] == "vendor/stub-1"

    def test_declared_dependencies_enter_the_fingerprint(self, tmp_path):
        from mt_eval_harness.publish import dependencies_sha256
        _, card, _, _ = _run(tmp_path, "a", model="vendor/stub-1")
        assert card["method_plugin"]["dependencies_sha256"] == \
            dependencies_sha256(DEPENDENCIES)
        assert dependencies_sha256(None) is None
        assert dependencies_sha256([]) != dependencies_sha256(None)
        (tmp_path / "x").mkdir()
        _, card_none, _, _ = _run(tmp_path / "x", "n", model="vendor/stub-1",
                                  deps=None)
        assert card_none["fingerprint"]["components"][
            "method_dependencies_sha256"] is None

    def test_lint_recomputes_the_same_plugin_fingerprint(self, tmp_path):
        sys.path.insert(0, str(ROOT / "scripts"))
        try:
            import lint_run_reports
        finally:
            sys.path.pop(0)
        log, _card, fp, _ = _run(tmp_path, "a", model="vendor/stub-1")
        assert lint_run_reports.compute_fingerprint(log) == fp

    def test_no_model_given_records_none(self, tmp_path):
        log, card, _, _ = _run(tmp_path, "a")
        assert log["config"]["method_model"] == ""
        assert card["fingerprint"]["components"]["method_model"] is None
        assert card["method_plugin"]["model_given"] is None

    def test_cli_records_a_given_model_even_the_default(self, tmp_path):
        from mt_eval_harness.cli import args_to_config, build_parser
        from mt_eval_harness.config import DEFAULT_MODEL
        plugin = _plugin(tmp_path)
        p = build_parser()
        given = args_to_config(p.parse_args(
            ["run", "--method", str(plugin), "-m", "stub-1",
             "--corpus", str(_corpus(tmp_path))]))
        assert given.method_model == "stub-1"
        # A plugin's model is in the plugin's own naming — not refused as an
        # unknown OpenRouter model, nor fuzzy-renamed.
        assert given.validate(prompt_versions=["naive"]) == []
        assert given.model == "stub-1"
        default = args_to_config(p.parse_args(
            ["run", "--method", str(plugin), "-m", DEFAULT_MODEL,
             "--corpus", str(_corpus(tmp_path))]))
        assert default.method_model == DEFAULT_MODEL
        none = args_to_config(p.parse_args(
            ["run", "--method", str(plugin),
             "--corpus", str(_corpus(tmp_path))]))
        assert none.method_model == ""
        # An LLM run is untouched.
        llm = args_to_config(p.parse_args(
            ["run", "-m", "stub-1", "--corpus", str(_corpus(tmp_path))]))
        assert llm.method_model == ""

    def test_other_runs_keep_their_fingerprint_components(self, tmp_path):
        """Only plugin runs gain the two components."""
        from mt_eval_harness.external_scoring import score_hypotheses
        hyps = tmp_path / "h.txt"
        data = json.loads(DEV_CORPUS.read_text())
        hyps.write_text("\n".join(e["reference"] for e in data["entries"]) + "\n")
        res = _quiet(score_hypotheses, corpus_path=DEV_CORPUS,
                     hypotheses_path=hyps, dataset_id=QUALIFIER_CORPUS,
                     source_lang="qaa", target_lang="qab", system_label="s",
                     method_class="pipeline", output_dir=tmp_path / "o",
                     compute_ci=False)
        from mt_eval_harness.publish import assemble_run_card
        card, _, _ = _quiet(assemble_run_card, res["report_path"])
        assert "method_model" not in card["fingerprint"]["components"]
        assert "method_plugin" not in card


# ---------------------------------------------------------------------------
# 2. The report names both composites
# ---------------------------------------------------------------------------

class TestReportComposites:
    """Round 5 found two composites under one name. The scoring standard
    (2026-10-04) retired both: the report and the card carry the chrF++
    headline, no published composite and no composite CI."""

    def test_report_and_card_carry_the_standard_not_a_composite(self, tmp_path):
        log, card, _, report_path = _run(tmp_path, "a", model="vendor/stub-1")
        report = json.loads(report_path.read_text())
        overall = report["overall"]
        assert "published_composite" not in overall
        assert overall["scoring_standard"] == card["scores"]["scoring_standard"] \
            == "standard/1"
        assert card["scores"]["composite"] is None
        cis = overall["confidence_intervals"]
        assert "corpus_chrf" in cis
        assert "segment_composite" not in cis and "composite_score" not in cis

    def test_the_run_card_shows_no_composite(self, tmp_path):
        from mt_eval_harness.run_card import render_run_card
        log, card, _, report_path = _run(tmp_path, "a", model="vendor/stub-1")
        run_log_path = report_path.with_name(
            report_path.stem.replace("_report", "") + ".json")
        text = render_run_card(run_log_path, report_path)
        assert "chrF++ (corpus)" in text
        assert "omposite" not in text
        assert "— published" not in text

    def test_an_old_report_shows_its_composite_only_as_legacy(self):
        from mt_eval_harness.run_card import composite_card_lines
        (line,) = composite_card_lines(
            {"published_composite": {"score": 0.2987,
                                     "quality_tier": "emerging"}})
        assert "Legacy composite" in line and "0.2987" in line
        assert "retired" in line and "emerging" not in line
        assert composite_card_lines({"scoring_standard": "standard/1"}) == []


# ---------------------------------------------------------------------------
# 4 + 5 + 7. The qualifier: source copies refused, receipts per system,
#            the cost said by the one rule
# ---------------------------------------------------------------------------

def _offline(threshold=1.0):
    return {"qualifier_id": QUALIFIER_ID, "threshold": threshold,
            "corpus_card_id": QUALIFIER_CORPUS, "language_pair": "qaa>qab",
            "year": 2026}


def _hyps(tmp_path, name, lines):
    p = tmp_path / name
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return p


def _sources():
    return [e["source"] for e in json.loads(DEV_CORPUS.read_text())["entries"]]


def _refs():
    return [e["reference"] for e in json.loads(DEV_CORPUS.read_text())["entries"]]


class TestQualifierSourceCopy:
    def test_an_echo_is_refused_whatever_it_scores(self, tmp_path, capsys):
        from mt_eval_harness.contest_qualify import (
            QualifierError, load_receipt, qualify)
        with pytest.raises(QualifierError, match="copies of their source"):
            qualify(CONTEST_ID, dev_hyp_path=_hyps(tmp_path, "echo.txt",
                                                    _sources()),
                    dev_corpus_path=DEV_CORPUS, system_label="echo",
                    method_class="pipeline", receipt_dir=tmp_path / "r",
                    offline_qualifier=_offline(threshold=0.0))
        out = capsys.readouterr().out
        assert "✗ Refused" in out
        receipt = load_receipt(CONTEST_ID, tmp_path / "r", system="echo")
        assert receipt["passed"] is False
        assert receipt["score"] >= receipt["threshold"]   # the score cleared
        assert receipt["refusal"]["rule"] == "source_copy"
        assert receipt["refusal"]["copy_share"] >= 0.5

    def test_copying_is_not_counted_where_the_reference_is_the_source(
            self, tmp_path):
        from mt_eval_harness.contest_qualify import source_copy_refusal
        report = tmp_path / "r.json"
        report.write_text(json.dumps({"entries": [
            {"source": "Oslo", "predicted": "Oslo", "expected": "Oslo"},
            {"source": "Hello there", "predicted": "Bures", "expected": "Bures"},
        ]}))
        assert source_copy_refusal(report) is None

    def test_the_node_refuses_an_echo_on_re_execution(self, tmp_path,
                                                      monkeypatch):
        """The same refusal on the organizer's node: its own execution of
        the method produced copies of the source."""
        from mt_eval_harness import sandbox_runner as sr
        from mt_eval_harness.external_scoring import score_hypotheses
        echo = _hyps(tmp_path, "echo.txt", _sources())

        def fake_execute(**kw):
            return score_hypotheses(
                corpus_path=kw["corpus_path"], hypotheses_path=echo,
                dataset_id=kw["sealed_set_id"], source_lang="qaa",
                target_lang="qab", system_label="x", method_class="pipeline",
                output_dir=kw["output_dir"], compute_ci=False)
        monkeypatch.setattr(sr, "execute_and_score", fake_execute)
        gate = _quiet(
            sr.verify_qualifier_by_execution,
            tmp_path / "bundle", "runnable-bundle",
            {"dev_corpus": str(DEV_CORPUS)},
            {"qualifier_id": QUALIFIER_ID, "corpus_card_id": QUALIFIER_CORPUS,
             "threshold": 0.0, "year": 2026},
            manifest={"qualifier": {"qualifierId": QUALIFIER_ID, "score": 9}},
            work_dir=tmp_path / "w", output_dir=tmp_path / "o",
            node_id="n1")
        assert gate["eligible"] is False
        assert "copies of their source" in gate["reason"]
        assert gate["refusal"]["rule"] == "source_copy"
        assert gate["measured"] >= gate["threshold"]

    def test_qualify_says_cost_by_the_one_rule(self, tmp_path, capsys):
        from mt_eval_harness.contest_qualify import qualify
        qualify(CONTEST_ID, dev_hyp_path=_hyps(tmp_path, "ok.txt", _refs()),
                dev_corpus_path=DEV_CORPUS, system_label="acme",
                method_class="pipeline", receipt_dir=tmp_path / "r",
                offline_qualifier=_offline())
        out = capsys.readouterr().out
        assert "$0.0000" not in out
        assert "unknown (outputs made outside the harness" in out

    def test_the_external_lane_records_cost_unknown(self, tmp_path):
        from mt_eval_harness.external_scoring import score_hypotheses
        from mt_eval_harness.run_card import cost_label
        res = _quiet(score_hypotheses, corpus_path=DEV_CORPUS,
                     hypotheses_path=_hyps(tmp_path, "h.txt", _refs()),
                     dataset_id=QUALIFIER_CORPUS, source_lang="qaa",
                     target_lang="qab", system_label="s",
                     method_class="pipeline", output_dir=tmp_path / "o",
                     compute_ci=False)
        log = json.loads(Path(res["run_log_path"]).read_text())
        assert log["total_cost_usd"] is None
        assert cost_label(None, log["config"], log["provenance"]).startswith(
            "unknown")
        assert cost_label(0.0, {"provider": "external"}, {}) == "$0.0000"


class TestReceiptsPerSystem:
    def _qualify(self, tmp_path, system):
        from mt_eval_harness.contest_qualify import qualify
        return _quiet(qualify, CONTEST_ID,
                      dev_hyp_path=_hyps(tmp_path, f"{system}.txt", _refs()),
                      dev_corpus_path=DEV_CORPUS, system_label=system,
                      method_class="pipeline", receipt_dir=tmp_path / "r",
                      offline_qualifier=_offline())

    def test_a_second_system_keeps_the_first(self, tmp_path):
        from mt_eval_harness.contest_qualify import (
            QualifierError, contest_receipts, load_receipt)
        self._qualify(tmp_path, "acme-nmt")
        self._qualify(tmp_path, "acme-rules")
        assert len(contest_receipts(CONTEST_ID, tmp_path / "r")) == 2
        assert load_receipt(CONTEST_ID, tmp_path / "r",
                            system="acme-nmt")["system"] == "acme-nmt"
        assert load_receipt(CONTEST_ID, tmp_path / "r",
                            system="acme-rules")["system"] == "acme-rules"
        # The submission's --name picks its own receipt…
        assert load_receipt(CONTEST_ID, tmp_path / "r",
                            name_hint="acme-rules")["system"] == "acme-rules"
        # …and with neither, two receipts are ambiguous: refused, listed.
        with pytest.raises(QualifierError, match="Several systems") as exc:
            load_receipt(CONTEST_ID, tmp_path / "r")
        assert "acme-nmt" in str(exc.value) and "acme-rules" in str(exc.value)
        with pytest.raises(QualifierError, match="No qualifier receipt for system"):
            load_receipt(CONTEST_ID, tmp_path / "r", system="acme-other")

    def test_labels_that_slug_alike_never_share_a_file(self, tmp_path):
        from mt_eval_harness.contest_qualify import receipt_path
        assert receipt_path(CONTEST_ID, tmp_path, system="Acme NMT") != \
            receipt_path(CONTEST_ID, tmp_path, system="acme-nmt")

    def test_requalifying_keeps_the_previous_receipt(self, tmp_path):
        from mt_eval_harness.contest_qualify import qualify, receipt_path
        self._qualify(tmp_path, "acme-nmt")
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            qualify(CONTEST_ID,
                    dev_hyp_path=_hyps(tmp_path, "again.txt", _refs()),
                    dev_corpus_path=DEV_CORPUS, system_label="acme-nmt",
                    method_class="pipeline", receipt_dir=tmp_path / "r",
                    offline_qualifier=_offline())
        dest = receipt_path(CONTEST_ID, tmp_path / "r", system="acme-nmt")
        history = list((dest.parent / "history").glob(f"{dest.stem}.*.json"))
        assert len(history) == 1
        assert "previous receipt for this system is kept" in buf.getvalue()

    def test_the_only_receipt_is_used_and_said(self, tmp_path, capsys):
        from mt_eval_harness.contest_qualify import load_receipt
        self._qualify(tmp_path, "acme-nmt")
        capsys.readouterr()
        r = load_receipt(CONTEST_ID, tmp_path / "r", name_hint="other-name")
        assert r["system"] == "acme-nmt"
        assert "only qualifier receipt" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# 6. node init --from-contest fills the prize-terms hash
# ---------------------------------------------------------------------------

def _prepared(tmp_path, registration):
    out = tmp_path / "prep"
    (out / "local").mkdir(parents=True)
    (out / "public").mkdir()
    dev = out / "public" / "dev.json"
    dev.write_text("{}")
    sec = out / "local" / "sec.sealed.json"
    sec.write_text("sealed")
    manifest = {
        "contest": {"id": "mytask", "slug": "mytask", "name": "My Task",
                    "language_pair": "eng>crk"},
        "qualifier": {"qualifier_id": "q", "corpus_card_id": "q",
                      "threshold": 1.0, "metric": "composite", "year": 2026,
                      "corpus_file": str(dev)},
        "secret": {"sealed_set_id": "eval-eng-crk-mytask-secret-v1",
                   "corpus_sealed_artifact": str(sec),
                   "sealed_block": {"keyScheme": "single-keypair-wave1"}},
        "holdout": None, "test_suites": []}
    if registration is not None:
        manifest["registration"] = registration
    (out / "local" / "manifest.json").write_text(json.dumps(manifest))
    return out


class TestNodeInitPrizeTerms:
    def test_declared_terms_fill_the_hash(self, tmp_path):
        from mt_eval_harness.contest_node import node_config_from_contest
        from mt_eval_harness.contest_prize_terms import terms_sha256
        terms = {"disposition": "retain_ip"}
        text, notes = node_config_from_contest(
            _prepared(tmp_path, {"prize_terms": terms}))
        entry = json.loads(text)["contests"]["mytask"]
        assert entry["prize_terms_sha256"] == terms_sha256(terms)
        assert any(n.startswith("prize_terms_sha256:") for n in notes)

    def test_no_prize_no_hash(self, tmp_path):
        from mt_eval_harness.contest_node import node_config_from_contest
        text, notes = node_config_from_contest(
            _prepared(tmp_path, {"prize_terms": None}))
        assert "prize_terms_sha256" not in json.loads(text)["contests"]["mytask"]
        assert any("a contest with no prize" in n for n in notes)

    def test_an_old_manifest_says_so(self, tmp_path):
        from mt_eval_harness.contest_node import node_config_from_contest
        _text, notes = node_config_from_contest(_prepared(tmp_path, None))
        assert any("predates recording them" in n for n in notes)

    def test_the_filled_hash_passes_the_node_config_check(self, tmp_path):
        """The value written is the shape load_node_config demands (64 hex)."""
        import re
        from mt_eval_harness.contest_node import node_config_from_contest
        text, _ = node_config_from_contest(
            _prepared(tmp_path, {"prize_terms": {
                "disposition": "release_open"}}))
        assert re.fullmatch(r"[0-9a-f]{64}", json.loads(text)["contests"][
            "mytask"]["prize_terms_sha256"])


# ---------------------------------------------------------------------------
# 8. The rules page is true to the tools
# ---------------------------------------------------------------------------

class TestRulesPage:
    def test_edtekla_is_not_offered_and_the_tools_list_the_datasets(self):
        text = (DOCS / "leaderboard" / "rules.md").read_text(encoding="utf-8")
        assert "### EDTeKLA Development Set v1" not in text
        assert "`edtekla-dev-v1`" not in text
        assert "mt-eval corpora" in text
        assert "quarantined" in text
        assert "Official evaluation uses custom corpora" not in text
        assert "run-a-sovereign-contest" in text


# ---------------------------------------------------------------------------
# 9. The local report says what the model was told
# ---------------------------------------------------------------------------

def _coached_log(tmp_path: Path) -> dict:
    coaching = tmp_path / "crk-coaching.txt"
    coaching.write_text("Use SRO orthography.")
    prompt = "You translate English to Plains Cree.\nUse SRO orthography."
    return {
        "run_id": "run_coached", "harness_version": "0.2.0",
        "config": {"model": "openai/gpt-x", "prompt_version": "coached",
                   "coaching_file": str(coaching), "target_lang": "French",
                   "source_lang": "English", "dataset": "all",
                   "batch_size": 25},
        "provenance": {"system_prompt_used": prompt,
                       "system_prompt_sha256": "a" * 64,
                       "coaching_prompt": "Use SRO orthography.",
                       "coaching_prompt_sha256": "b" * 64,
                       "corpus_sha256": "c" * 64},
        "results": [{"id": "1", "source": "hello", "expected": "tânisi",
                     "predicted": "tânisi", "error": None, "latency_s": 0.1,
                     "usage": {}, "cost_usd": None, "segment": "dev",
                     "difficulty": 1, "domain": "", "metadata": {}},
                    {"id": "2", "source": "thanks", "expected": "kinanâskomitin",
                     "predicted": "ekosi", "error": None, "latency_s": 0.1,
                     "usage": {}, "cost_usd": None, "segment": "dev",
                     "difficulty": 1, "domain": "", "metadata": {}}],
    }


class TestInstructionsPointer:
    def test_the_report_points_at_what_the_model_got(self, tmp_path):
        from mt_eval_harness.tester import analyze_run_log
        log = _coached_log(tmp_path)
        log_path = tmp_path / "run_coached.json"
        log_path.write_text(json.dumps(log))
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            report = analyze_run_log(log, output_path=tmp_path / "r.json",
                                     compute_ci=False,
                                     source_log_path=str(log_path))
        instr = report["instructions"]
        assert instr["coaching"] == "crk-coaching.txt"   # a name, not a path
        assert instr["coaching_sha256"] == "b" * 64
        assert instr["system_prompt_sha256"] == "a" * 64
        assert instr["system_prompt_chars"] == len(
            log["provenance"]["system_prompt_used"])
        assert instr["full_text_in"] == str(log_path)
        assert "provenance.system_prompt_used" in instr["full_text_keys"]
        # A pointer, never the text itself.
        assert "Plains Cree" not in json.dumps(instr)
        assert "Instructions:" in buf.getvalue()

    def test_the_run_card_shows_it_and_publish_never_copies_it(self, tmp_path):
        from mt_eval_harness.publish import assemble_run_card
        from mt_eval_harness.run_card import render_run_card
        from mt_eval_harness.tester import analyze_run_log
        log = _coached_log(tmp_path)
        log_path = tmp_path / "run_coached.json"
        log_path.write_text(json.dumps(log))
        report_path = tmp_path / "run_coached_report.json"
        _quiet(analyze_run_log, log, output_path=report_path,
               compute_ci=False, source_log_path=str(log_path))
        text = render_run_card(log_path, report_path)
        assert "Instructions" in text and "crk-coaching.txt" in text
        card, _, _ = _quiet(assemble_run_card, report_path)
        assert "instructions" not in card

    def test_a_plugin_run_has_no_harness_prompt_to_point_at(self, tmp_path):
        from mt_eval_harness.tester import instructions_pointer
        assert instructions_pointer({"config": {"method_path": "/p"},
                                     "provenance": {}}) is None


# ---------------------------------------------------------------------------
# 9 (follow-up). An outside producer's run is named by its method card
# ---------------------------------------------------------------------------

def _forge_shaped_log(tmp_path: Path, run_name: str, *,
                      mt_method="nmt-forge") -> Path:
    """A RunLog shaped like nmt-forge's export/evaluate write it: mt_method
    "nmt-forge" for every model, the model named by an embedded card."""
    import re
    mid = re.sub(r"[^a-z0-9]+", "-", f"nmt-forge-{run_name}".lower()).strip("-")
    log = {
        "run_id": f"nmt-forge_{run_name}", "harness_version": "0.2.0",
        "timestamp_start": "2026-10-03T00:00:00+00:00", "elapsed_s": 1.0,
        "config": {"model": f"nmt-forge/{run_name}@abc", "mt_method": mt_method,
                   "provider": "local", "prompt_version": "pipeline",
                   "source_lang": "English", "target_lang": "French",
                   "dataset": "all", "batch_size": 25, "temperature": 0.0},
        "provenance": {"corpus_sha256": "d" * 64, "system_prompt_sha256": "",
                       "method_card": {"method_id": mid,
                                       "name": f"nmt-forge model {run_name}",
                                       "class": "pipeline",
                                       "paradigm": "neural-nmt",
                                       "version": "abcdef123456"}},
        "results": [{"id": str(i), "source": f"hello {i}",
                     "expected": f"bonjour {i}", "predicted": f"bonjour {i}",
                     "error": None, "latency_s": 0.1, "usage": {},
                     "cost_usd": 0.0, "segment": "test", "difficulty": 1,
                     "domain": "", "metadata": {}} for i in range(4)],
        "total_cost_usd": 0.0,
    }
    d = tmp_path / run_name
    d.mkdir()
    path = d / "runlog.json"
    path.write_text(json.dumps(log))
    from mt_eval_harness.tester import analyze_run_log
    _quiet(analyze_run_log, log, output_path=d / "runlog_report.json",
           compute_ci=False, source_log_path=str(path))
    return d / "runlog_report.json"


class TestOutsideProducerSlug:
    def test_two_forge_models_get_two_slugs(self, tmp_path):
        from mt_eval_harness.publish import assemble_run_card
        a, _, fa = _quiet(assemble_run_card, _forge_shaped_log(tmp_path, "nav-a"))
        b, _, fb = _quiet(assemble_run_card, _forge_shaped_log(tmp_path, "nav-b"))
        assert a["model_slug"] == "nmt-forge-nav-a"
        assert b["model_slug"] == "nmt-forge-nav-b"
        assert a["model_id"] == "nmt-forge-nav-a"
        assert a["fingerprint"]["components"]["model_slug"] == "nmt-forge-nav-a"
        assert fa != fb

    def test_a_registered_engine_keeps_its_engine_slug(self, tmp_path):
        from mt_eval_harness.publish import assemble_run_card
        card, _, _ = _quiet(assemble_run_card, _forge_shaped_log(
            tmp_path, "x", mt_method="google-translate"))
        assert card["model_slug"] == "google-translate"

    def test_lint_derives_the_same_slug(self):
        sys.path.insert(0, str(ROOT / "scripts"))
        try:
            import lint_run_reports
        finally:
            sys.path.pop(0)
        cfg = {"mt_method": "nmt-forge", "model": "nmt-forge/x@a"}
        prov = {"method_card": {"method_id": "nmt-forge-x"}}
        assert lint_run_reports.derive_model_slug(cfg, prov) == "nmt-forge-x"
        assert lint_run_reports.derive_model_slug(
            {"mt_method": "deepl"}, prov) == "deepl"

    def test_an_id_past_the_column_cap_is_refused_before_the_database(self):
        from mt_eval_harness.publish import MODEL_SLUG_MAX, _outside_producer_id
        with pytest.raises(ValueError, match="at most 300"):
            _outside_producer_id(
                {"mt_method": "nmt-forge"},
                {"method_card": {"method_id": "a" * (MODEL_SLUG_MAX + 1)}})


# ---------------------------------------------------------------------------
# 10 (follow-up). The harness's own in-process local-model adapter is local
# ---------------------------------------------------------------------------

class TestInProcessTransport:
    def _policy(self, mode):
        from mt_eval_harness.transmission_policy import TransmissionPolicy
        return TransmissionPolicy(mode, "local-only corpus (steward's mark)")

    @pytest.mark.parametrize("mode", ["sealed", "consent-required", "no-train"])
    def test_in_process_needs_no_attestation(self, mode):
        from mt_eval_harness import transmission_policy as tp
        prov = tp.enforce_transmission_policy(
            self._policy(getattr(tp, {"sealed": "MODE_SEALED",
                                      "consent-required": "MODE_CONSENT_REQUIRED",
                                      "no-train": "MODE_NO_TRAIN"}[mode])),
            provider_name=None, provider_supports_restricted=True,
            provider_basis="", has_external_method=False,
            in_process_method="local-model")
        assert prov["enforced"] is True and prov["channel"] == "in-process"
        assert "local_transport_attested" not in prov

    def test_a_third_party_plugin_still_needs_the_attestation(self):
        from mt_eval_harness import transmission_policy as tp
        with pytest.raises(RuntimeError, match="--attest-local-transport"):
            tp.enforce_transmission_policy(
                self._policy(tp.MODE_SEALED), provider_name=None,
                provider_supports_restricted=True, provider_basis="",
                has_external_method=True)

    def test_only_the_local_model_adapter_is_in_process(self):
        from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY
        assert [n for n, c in MT_METHOD_REGISTRY.items()
                if getattr(c, "in_process_transport", False)] == ["local-model"]

    def test_a_local_only_corpus_runs_on_local_model_without_attesting(
            self, tmp_path, monkeypatch):
        from mt_eval_harness.methods.local_model import LocalModelMethod
        from mt_eval_harness.runner import execute_run
        monkeypatch.setattr(LocalModelMethod, "_resolve_credentials",
                            lambda self: {"model_id": "Helsinki-NLP/opus-mt-en-fr",
                                          "family": "opus",
                                          "backend": "transformers"})
        monkeypatch.setattr(LocalModelMethod, "_infer",
                            lambda self, texts, src, tgt, creds:
                            [t.upper() for t in texts])
        corpus = _corpus(tmp_path)
        Path(str(corpus) + ".champollion.json").write_text(
            json.dumps({"transmission": "local-only"}))
        cfg = RunConfig(mt_method="local-model",
                        model="Helsinki-NLP/opus-mt-en-fr",
                        corpus_path=str(corpus), target_lang="French",
                        output_dir=str(tmp_path / "out"),
                        cache_dir=str(tmp_path / "cache"), dataset="all")
        log = _quiet(lambda: asyncio.run(execute_run(cfg)))
        tp = log["config"]["transmission_policy"]
        assert tp["enforced"] is True and tp["channel"] == "in-process"
        assert not log["config"]["attest_local_transport"]

    def test_a_plugin_on_a_local_only_corpus_still_refuses(self, tmp_path):
        from mt_eval_harness.runner import execute_run
        corpus = _corpus(tmp_path)
        Path(str(corpus) + ".champollion.json").write_text(
            json.dumps({"transmission": "local-only"}))
        cfg = RunConfig(method_path=str(_plugin(tmp_path)),
                        corpus_path=str(corpus), target_lang="French",
                        output_dir=str(tmp_path / "out"),
                        cache_dir=str(tmp_path / "cache"), dataset="all")
        with pytest.raises(RuntimeError, match="--attest-local-transport"):
            _quiet(lambda: asyncio.run(execute_run(cfg)))


def test_an_in_process_model_costs_nothing_in_api_fees():
    """The harness's own local-model adapter and an nmt-forge export decode
    in this process: '$0 API cost', never 'unknown (engine has no published
    price)' and never a fabricated $0.0000 number."""
    from mt_eval_harness.run_card import cost_label
    assert cost_label(None, {"mt_method": "local-model"},
                      {"endpoint_locality": "in-process"}) == \
        "$0 API cost (runs on this machine)"
    assert cost_label(None, {"mt_method": "nmt-forge"},
                      {"endpoint_locality": "in-process"}) == \
        "$0 API cost (runs on this machine)"
    # an engine service without the mark stays unknown
    assert cost_label(None, {"mt_method": "apertium"}, {}).startswith("unknown")
