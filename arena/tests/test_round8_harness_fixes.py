"""Round 8 synthetic researcher (eng→sme), school (eng→crk) and hospital
(qaa) findings — the harness side.

Each class names the finding it holds the line on. Run with
``PYTHONPATH=<worktree>/arena`` (system python3 otherwise imports another
checkout's harness).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from mt_eval_harness.cli import build_parser


def _sha256(path: Path) -> str:
    import hashlib
    return hashlib.sha256(path.read_bytes()).hexdigest()


# ---------------------------------------------------------------------------
# 4. Offline node commands never print the service-key text
# ---------------------------------------------------------------------------

class TestOfflineNodeCommandsNeverAskForTheKey:
    """Every `--offline` node command printed six lines telling the operator
    to set MT_EVAL_SUPABASE_SERVICE_KEY "… or add --offline", with --offline
    given: loading node.json compared the node's test suites with the contest
    database on EVERY load. Only database commands compare now."""

    KEY_TEXT = ("SERVICE_KEY", "add --offline", "service-role key")

    @pytest.fixture
    def node_json(self, tmp_path, monkeypatch):
        monkeypatch.delenv("MT_EVAL_SUPABASE_SERVICE_KEY", raising=False)
        # Any database call at all is a failure of this test.
        from mt_eval_harness import contest_node

        def asked(*a, **kw):
            raise AssertionError("an offline node command asked the database")
        monkeypatch.setattr(contest_node, "_fetch_rows", asked)
        monkeypatch.setattr(contest_node, "service_request", asked)
        suite = tmp_path / "suite.json"
        suite.write_text(json.dumps([{"source": "a", "expected": "b"}]),
                         encoding="utf-8")
        state = tmp_path / "airgap-state"
        cfg = {"node_id": "node-r8",
               "airgap": {"state_dir": str(state)},
               "contests": {"c1": {
                   "secret_set_id": "eval-s-v1",
                   "secret_artifact": str(tmp_path / "a.sealed.json"),
                   "test_suites": [{"suite_id": "eval-diag-v1",
                                    "corpus_path": str(suite),
                                    "corpus_sha256": _sha256(suite)}]}}}
        p = tmp_path / "node.json"
        p.write_text(json.dumps(cfg), encoding="utf-8")
        (tmp_path / "exchange").mkdir()
        return p

    @pytest.mark.parametrize("argv", [
        ["node", "list", "--offline"],
        ["node", "approve", "authreq-x", "--actor", "c", "--offline"],
        ["node", "deny", "authreq-x", "--actor", "c", "--reason", "r",
         "--offline"],
        ["node", "run-method", "authreq-x", "--offline"],
        ["node", "import-bundle", "{exchange}"],
        ["node", "export-scores", "{exchange}"],
        ["node", "ledger", "verify"],
        ["node", "manifest", "write", "{exchange}", "--direction", "out"],
    ])
    def test_offline_command_prints_no_key_text(self, argv, node_json,
                                                monkeypatch, capsys):
        from mt_eval_harness import cli
        exchange = str(node_json.parent / "exchange")
        argv = [a.replace("{exchange}", exchange) for a in argv]
        monkeypatch.setattr(sys, "argv",
                            ["mt-eval", *argv, "--config", str(node_json)])
        try:
            cli.main()
        except SystemExit:
            pass   # an unknown request id is a refusal — not the point here
        out = capsys.readouterr()
        text = out.out + out.err
        for needle in self.KEY_TEXT:
            assert needle not in text, f"{argv}: printed {needle!r}:\n{text}"


# ---------------------------------------------------------------------------
# 5. Global flags after any subcommand
# ---------------------------------------------------------------------------

def _all_subparsers(parser, path=()):
    import argparse
    for action in parser._actions:
        if isinstance(action, argparse._SubParsersAction):
            seen = set()
            for name, sub in action.choices.items():
                if id(sub) in seen:
                    continue
                seen.add(id(sub))
                yield (*path, name), sub
                yield from _all_subparsers(sub, (*path, name))


class TestGlobalFlagsAfterAnySubcommand:
    """`mt-eval setup --non-interactive --lang sme` died with a usage wall:
    only seven subcommands carried the global flags."""

    def test_every_subcommand_accepts_both_global_flags(self):
        missing = []
        for path, sub in _all_subparsers(build_parser()):
            for flag in ("--non-interactive", "--json"):
                if flag not in sub._option_string_actions:
                    missing.append(f"{' '.join(path)} {flag}")
        assert not missing, missing

    def test_setup_non_interactive_after_the_subcommand(self):
        a = build_parser().parse_args(
            ["setup", "--non-interactive", "--lang", "sme"])
        assert a.non_interactive is True and a.lang == "sme"

    def test_main_parser_still_does_not_abbreviate(self):
        assert build_parser().allow_abbrev is False

    def test_a_subcommand_own_json_keeps_its_meaning(self):
        a = build_parser().parse_args(["node", "egress-check", "--json"])
        assert a.as_json is True

    def test_setup_without_a_flag_never_prompts_when_non_interactive(
            self, monkeypatch, capsys):
        from mt_eval_harness import setup_wizard as sw

        def no_prompt(*a, **kw):
            raise AssertionError("prompted in non-interactive mode")
        monkeypatch.setattr("builtins.input", no_prompt)
        monkeypatch.setattr(sw, "install_comet", no_prompt)
        monkeypatch.setattr(sw, "install_pyhfst", no_prompt)
        sw.run_setup(non_interactive=True)
        assert "nothing was installed" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# Shared: a crk run with a copy plugin, FST lane absent (items 1, 2, 10)
# ---------------------------------------------------------------------------

import asyncio
import contextlib
import io
import types

from mt_eval_harness.config import RunConfig

COPY_PLUGIN = '''
class Copy:
    name = "copy-model"
    async def translate(self, entries, config):
        return [{"id": e["id"], "predicted": e["source"], "latency_s": 0.0,
                 "usage": {}, "error": None, "tool_calls": [],
                 "tool_call_count": 0, "metadata": {}} for e in entries]
'''


def _plugin(tmp_path: Path) -> Path:
    d = tmp_path / "plug"
    d.mkdir(exist_ok=True)
    (d / "method.json").write_text(json.dumps({
        "name": "Copy", "method_id": "copy-model", "class": "pipeline",
        "entry_point": "copyplug:Copy", "version": "0.1.0"}))
    (d / "copyplug.py").write_text(COPY_PLUGIN)
    return d


@pytest.fixture
def no_fst_crk(monkeypatch):
    """Plains Cree with its FST pinned but nothing of the lane installed:
    no analyzer, no pyhfst, no eval standard (nothing is installed for real,
    nothing is downloaded — any install attempt fails the test)."""
    from mt_eval_harness import language_cards as lc
    from mt_eval_harness.plugins import fst_installer
    real_pack = lc.get_eval_pack
    monkeypatch.setattr(lc, "get_eval_pack", lambda code: (
        {"pythonDeps": {"pyhfst": "pyhfst>=1.4"}, "requiresFst": True}
        if lc.resolve_code(code) == "crk" else real_pack(code)))
    monkeypatch.setattr(lc, "get_eval_metrics", lambda code: None)
    monkeypatch.setattr(fst_installer, "is_fst_installed", lambda code: False)
    monkeypatch.setitem(sys.modules, "pyhfst", None)

    def no_install(*a, **kw):
        raise AssertionError("something tried to install or download")
    monkeypatch.setattr(fst_installer, "install_fst", no_install)
    monkeypatch.setattr(fst_installer, "prompt_fst_install", no_install)
    monkeypatch.setattr("mt_eval_harness.setup_wizard._pip_install", no_install)


def _crk_run(tmp_path, **cfg):
    from mt_eval_harness.runner import execute_run
    corpus = tmp_path / "crk.json"
    corpus.write_text(json.dumps({
        "dataset": {"language_pair": {"source": "eng", "target": "crk"}},
        "entries": [{"id": str(i), "source": f"tânisi {i}",
                     "reference": f"tânisi {i}"} for i in range(4)]}),
        encoding="utf-8")
    config = RunConfig(method_path=str(_plugin(tmp_path)),
                       corpus_path=str(corpus), target_lang="Plains Cree",
                       target_lang_code="crk", dataset="all",
                       output_dir=str(tmp_path / "out"),
                       cache_dir=str(tmp_path / "cache"), **cfg)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        asyncio.run(execute_run(config))
    report_path = next((tmp_path / "out").glob("*_report.json"))
    return json.loads(report_path.read_text(encoding="utf-8")), \
        report_path, buf.getvalue()


# ---------------------------------------------------------------------------
# 10. A missing FST lane is an advisory: the run completes
# ---------------------------------------------------------------------------

class TestMissingFstIsAnAdvisory:
    def test_a_crk_run_without_the_fst_completes_and_says_not_computed(
            self, tmp_path, no_fst_crk):
        report, _, out = _crk_run(tmp_path)
        assert "proceeds WITHOUT FST scoring" in out
        assert "mt-eval setup --lang crk" in out
        assert "mt-eval test <run log>" in out
        fst = report["overall"]["plugin_metrics"]["giellalt_fst_validity"]
        assert fst["error"].startswith("not computed:")
        assert "mt-eval setup --lang crk" in fst["error"]
        avail = report["overall"]["metric_availability"]
        assert avail["fst_acceptance_rate"].startswith("unavailable: not computed")
        assert avail["morphological_accuracy"].startswith("unavailable:")

    def test_skip_fst_still_says_nothing_more(self, tmp_path, no_fst_crk):
        report, _, out = _crk_run(tmp_path, skip_fst=True)
        assert "proceeds WITHOUT FST scoring" not in out
        assert "--skip-fst" in report["overall"]["plugin_metrics"][
            "giellalt_fst_validity"]["error"]

    def test_mt_eval_test_rescores_once_the_fst_is_there(
            self, tmp_path, no_fst_crk, monkeypatch):
        """The advisory's promise: after the install, `mt-eval test <run
        log>` adds the FST metric without re-translating — discovery then
        registers the real metric (the analyzer and runtime are faked as
        installed; nothing is fetched)."""
        from mt_eval_harness.plugin_discovery import discover_metric_plugins
        from mt_eval_harness.plugins import fst_installer
        from mt_eval_harness.plugins.giellalt_fst import GiellaLTFSTMetric
        _, report_path, _ = _crk_run(tmp_path)
        log = json.loads(report_path.with_name(
            report_path.name.replace("_report.json", ".json")).read_text())
        monkeypatch.setattr(fst_installer, "is_fst_installed", lambda c: True)
        monkeypatch.setitem(sys.modules, "pyhfst", types.ModuleType("pyhfst"))
        monkeypatch.setattr(fst_installer, "ensure_fst_available",
                            lambda *a, **k: tmp_path)
        with contextlib.redirect_stdout(io.StringIO()):
            plugins = discover_metric_plugins(log["config"])
        assert any(isinstance(p, GiellaLTFSTMetric) for p in plugins)


# ---------------------------------------------------------------------------
# 1. COMET / MetricX rows on the run card; 2. the cost label in the report
# ---------------------------------------------------------------------------

class TestNeuralRowsAndCostLabel:
    def test_report_and_card_say_why_comet_is_missing(
            self, tmp_path, no_fst_crk, monkeypatch):
        from mt_eval_harness import metrics_comet
        from mt_eval_harness.run_card import render_run_card
        monkeypatch.setattr(metrics_comet, "HAS_COMET", False)
        monkeypatch.setattr(metrics_comet, "comet_python_blocker", lambda: None)
        monkeypatch.setattr(metrics_comet, "COMET_IMPORT_ERROR",
                            "ModuleNotFoundError: No module named 'comet'")
        report, report_path, out = _crk_run(tmp_path)
        assert "⚠ COMET: not computed" in out
        overall = report["overall"]
        assert overall["comet_unavailable"] == (
            "unbabel-comet is not installed — mt-eval setup --comet")
        assert overall["metric_availability"]["comet_score"] == (
            "unavailable: unbabel-comet is not installed — mt-eval setup --comet")
        card = render_run_card(report_path.with_name(
            report_path.name.replace("_report.json", ".json")))
        comet = [l for l in card.splitlines() if "COMET" in l]
        assert comet and "not computed" in comet[0]
        assert "setup --comet" in card
        metricx = [l for l in card.splitlines() if "MetricX" in l]
        assert metricx and "not run" in metricx[0] and "--metricx" in metricx[0]
        for line in card.splitlines():
            assert len(line) <= 2 + 72, f"box broken: {line!r}"

    def test_the_report_carries_the_same_cost_words(self, tmp_path, no_fst_crk):
        from mt_eval_harness.run_card import run_cost_label
        report, report_path, _ = _crk_run(tmp_path)
        assert report["overall"]["total_cost_usd"] is None   # never a fake $0
        log = json.loads(report_path.with_name(
            report_path.name.replace("_report.json", ".json")).read_text())
        assert report["overall"]["cost_label"] == run_cost_label(log, report)

    def test_local_loopback_reads_zero_api_cost_in_the_report(self):
        from mt_eval_harness.run_card import run_cost_label
        log = {"config": {"provider": "local"}, "total_cost_usd": None,
               "provenance": {"endpoint_locality": "loopback"}}
        assert run_cost_label(log, {}) == "$0 API cost (runs on this machine)"


# ---------------------------------------------------------------------------
# 3. The publish preview: trust, score lane, anonymous
# ---------------------------------------------------------------------------

class TestPublishPreviewSaysHowTheRowIsListed:
    def _preview(self, tmp_path, capsys, **kw):
        from mt_eval_harness import publish
        from test_publish import _write_pair
        report_path = _write_pair(tmp_path, "r8")
        publish.publish_to_supabase(report_path, dry_run=True, **kw)
        return capsys.readouterr().out

    def test_trust_and_lane(self, tmp_path, capsys):
        out = self._preview(tmp_path, capsys)
        assert "Trust:         unverified — listed as self-benchmarked" in out
        lane = next(l for l in out.splitlines() if l.strip().startswith("Score lane:"))
        assert ("relative-comparison-only" in lane
                or "absolute-quality" in lane)

    def test_anonymous_dry_run_names_the_identity(self, tmp_path, capsys):
        out = self._preview(tmp_path, capsys, anonymous=True)
        assert "Submitter:     anonymous — no sign-in" in out
        assert "not authenticated" not in out


# ---------------------------------------------------------------------------
# 6. Install commands that work without a pip executable
# ---------------------------------------------------------------------------

class TestInstallCommandWording:
    def test_python_m_pip_by_default(self, monkeypatch):
        from mt_eval_harness import setup_wizard as sw
        monkeypatch.setattr(sw, "_uv_created_venv", lambda: False)
        assert sw.pip_install_hint("mt-eval-harness[metricx]") == (
            "python3 -m pip install 'mt-eval-harness[metricx]'")

    def test_uv_venv_without_pip_says_uv(self, monkeypatch):
        import importlib.util
        from mt_eval_harness import setup_wizard as sw
        monkeypatch.setattr(sw, "_uv_created_venv", lambda: True)
        real = importlib.util.find_spec
        monkeypatch.setattr(importlib.util, "find_spec",
                            lambda name, *a: None if name == "pip" else real(name, *a))
        assert sw.pip_install_hint("zz>=1") == "uv pip install 'zz>=1'"

    def test_uv_detection_reads_pyvenv_cfg(self, tmp_path, monkeypatch):
        from mt_eval_harness import setup_wizard as sw
        (tmp_path / "pyvenv.cfg").write_text("home = /x\nuv = 0.8.4\n")
        monkeypatch.setattr(sw.sys, "prefix", str(tmp_path))
        monkeypatch.setattr(sw.sys, "base_prefix", "/usr")
        assert sw._uv_created_venv() is True
        (tmp_path / "pyvenv.cfg").write_text("home = /x\nversion = 3.12\n")
        assert sw._uv_created_venv() is False

    def test_no_bare_pip_install_left_in_messages(self):
        """Every install COMMAND the package prints says `python3 -m pip
        install` (or comes from pip_install_hint). Docstrings and comments
        that merely mention a pip install are not commands."""
        import ast
        import re
        root = Path(__file__).resolve().parents[1] / "mt_eval_harness"
        cmd = re.compile(r"(?<![\w-])pip install (?=[\w']|\"\w)")
        bad = []
        for f in root.rglob("*.py"):
            src = f.read_text(encoding="utf-8")
            doc_lines: set[int] = set()
            for node in ast.walk(ast.parse(src)):
                body = getattr(node, "body", None)
                if (isinstance(body, list) and body
                        and isinstance(body[0], ast.Expr)
                        and isinstance(getattr(body[0], "value", None), ast.Constant)
                        and isinstance(body[0].value.value, str)):
                    doc_lines.update(range(body[0].lineno,
                                           body[0].end_lineno + 1))
            for n, line in enumerate(src.splitlines(), 1):
                if n in doc_lines or line.strip().startswith("#"):
                    continue
                for m in cmd.finditer(line):
                    if not line[:m.start()].endswith(("-m ", "uv ")):
                        bad.append(f"{f.relative_to(root)}:{n}: {line.strip()}")
        assert not bad, "\n".join(bad)


# ---------------------------------------------------------------------------
# 8. corpora --with-fst
# ---------------------------------------------------------------------------

class TestCorporaWithFst:
    def test_flag_parses_alone(self):
        a = build_parser().parse_args(["corpora", "--with-fst"])
        assert a.with_fst is True

    def test_only_pinned_targets_each_with_its_state(self, monkeypatch):
        from mt_eval_harness import config as cfg
        from mt_eval_harness import corpora_browse as cb
        states = {"sme": {"analyzer_installed": True, "runtime_installed": True,
                          "auto_install": True, "format": "divvun-macos-pkg",
                          "setup_command": "mt-eval setup --lang sme",
                          "line": "FST for Northern Sami (sme): installed here"}}
        monkeypatch.setattr(cfg, "fst_state", lambda code: states.get(code))
        infos = [{"id": "a", "target": "sme", "target_resolved": "sme"},
                 {"id": "b", "target": "fra", "target_resolved": "fra"}]
        kept = cb.with_fst(infos)
        assert [i["id"] for i in kept] == ["a"]
        assert kept[0]["fst"]["setup_command"] == "mt-eval setup --lang sme"
        assert cb.fst_footer(kept) == [
            "  FST for each target (pinned by this harness; nothing downloads "
            "by itself):", "    FST for Northern Sami (sme): installed here", ""]

    def test_cli_json_lists_only_fst_targets(self, monkeypatch, capsys):
        from mt_eval_harness import cli
        from mt_eval_harness import language_cards as lc
        monkeypatch.setattr(sys, "argv", ["mt-eval", "corpora", "--source",
                                          "eng", "--with-fst", "--json"])
        with pytest.raises(SystemExit) as exc:
            cli.main()
        assert not exc.value.code
        doc = json.loads(capsys.readouterr().out)
        assert doc["with_fst"] is True
        pinned = set(lc.fst_pinned_codes())
        assert doc["corpora"], "the registry has eng→FST-language corpora"
        for c in doc["corpora"]:
            assert c["target_resolved"] in pinned and "line" in c["fst"]


# ---------------------------------------------------------------------------
# 11. One wording for what is installed and that nothing downloads
# ---------------------------------------------------------------------------

class TestOneFstWording:
    def test_fst_state_says_nothing_downloads(self, no_fst_crk):
        from mt_eval_harness.config import fst_state
        st = fst_state("crk")
        assert st["ready"] is False and st["auto_install"] is True
        assert st["setup_command"] == "mt-eval setup --lang crk"
        assert "Nothing downloads unless you run `mt-eval setup --lang crk`" in st["line"]
        assert "pyhfst" in st["line"]

    def test_setup_status_never_promises_an_auto_download(self, no_fst_crk, capsys):
        from mt_eval_harness.setup_wizard import print_status
        print_status()
        out = capsys.readouterr().out
        assert "auto-download" not in out
        assert "Nothing downloads by itself" in out
        assert "crk" in out and "mt-eval setup --lang crk" in out

    def test_eval_pack_json_carries_the_fst_line(self, no_fst_crk):
        from mt_eval_harness.config import eval_pack_json, eval_pack_status
        st = eval_pack_status({"id": "x", "language_pair": {"target": "crk"}})
        js = eval_pack_json(st, blocks_run=True)
        assert js["blocks_run"] is False
        assert js["fst"]["line"] == st["fst"]["line"]


# ---------------------------------------------------------------------------
# 12. compare's significance tables carry each run's score caveats
# ---------------------------------------------------------------------------

class TestCompareShowsCaveatsBesideBetter:
    def _report(self, path, run_id, wrong_every, caveat=None):
        refs = [f"le chat numero {i} mange la souris grise" for i in range(30)]
        entries = []
        for i, ref in enumerate(refs):
            pred = ref if (wrong_every and i % wrong_every) else "x " + ref
            entries.append({"id": i, "source": f"src {i}", "expected": ref,
                            "predicted": pred, "exact_match": pred == ref,
                            "chrf_score": 50.0})
        report = {"run_id": run_id, "config": {"model": run_id},
                  "overall": {"evaluated": 30, "corpus_chrf": 60.0,
                              "corpus_bleu": 30.0,
                              "exact_match_rate": sum(e["exact_match"]
                                                      for e in entries) / 30},
                  "entries": entries}
        if caveat:
            report["score_caveats"] = [caveat]
        p = path / f"{run_id}_report.json"
        p.write_text(json.dumps(report), encoding="utf-8")
        return p

    def test_better_is_never_read_without_the_caveat(self, tmp_path):
        from mt_eval_harness.compare import run_compare
        caveat = {"kind": "train_test_near_twin", "severity": "major",
                  "source": "nmt-forge", "recall_not_translation": True,
                  "message": "150/150 test sentences have a near twin in "
                             "training — recall, not translation"}
        a = self._report(tmp_path, "small-data", 2)
        b = self._report(tmp_path, "all-data", 10, caveat=caveat)
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            run_compare([str(a), str(b)], str(tmp_path / "c.json"),
                        significance=True, n_bootstrap=50)
        out = buf.getvalue()
        sig = out[out.index("--- A (small-data) vs B (all-data) ---"):]
        assert "B⚠" in sig.split("\n")[2], "the column carries the mark"
        assert any(l.rstrip().endswith("B⚠") or "B⚠ (n.s.)" in l
                   for l in sig.splitlines()), "every Better naming B is marked"
        assert "⚠ = B's scores carry a score caveat" in sig
        assert "recall, not translation" in sig[sig.index("⚠ Score caveats"):]
