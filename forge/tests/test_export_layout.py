"""What `nmt-forge export` writes, and where — synthetic school persona,
Round 3 (eng→crk), 2026-10-03.

1. The deployable model directory holds no corpus text. The RunLog and
   TestReport (the teacher-checked test sentences, in plain text) used to
   sit inside the folder DEPLOY.md called "a self-contained, offline
   model"; copying it to a server shipped the community's test set. Now
   ``<out>/model/`` is weights + tokenizer + serving settings + the card,
   and ``<out>/evaluation/`` — which DEPLOY.md says never to copy — holds
   the evidence, each file carrying the steward's mark when the set has one.
2. The export's mt-eval report is the harness's own battery for the target
   language (``discover_metric_plugins``), and what it could not compute is
   listed with the command that computes it — never left out silently.
4. `serve` on a busy port says the port is taken and how to pick another.
5. DEPLOY.md shows the per-pair ``fallback`` config next to the primary one.

The HF backend is not needed: the model copy and the decode are stood in
for (the subject is the packaging, not the weights). All text is invented
tokens (quarantine-gate discipline).
"""

from __future__ import annotations

import json
import re
import socket
from pathlib import Path

import pytest

from nmt_forge.errors import ForgeError
from nmt_forge.workspace import Workspace
from tests.test_private_text import PRIVATE_MARKERS, _dummy_run, _run


def _private_text_in(path: Path) -> bool:
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        text = path.read_bytes().decode("latin-1")
    return any(m in text for m in PRIVATE_MARKERS)


@pytest.fixture
def hf_export(tmp_path, capsys, monkeypatch):
    """A full export (model included) of a run whose test set is the
    school's local-only TSV: the HF weights copy and the decode are stood
    in for, everything else is real."""
    ws_dir, manifest = _dummy_run(tmp_path, capsys)
    raw = json.loads(Path(manifest).read_text())["config"]
    raw["model"] = {"backend": "hf-seq2seq", "base": "fake/opus-mt-en-qaa"}
    cfg = tmp_path / "config-hf.json"
    cfg.write_text(json.dumps(raw))

    def fake_copy(src, dst, model_cfg):
        dst.mkdir(parents=True, exist_ok=True)
        for name in ("config.json", "generation_config.json",
                     "tokenizer.json", "tokenizer_config.json"):
            (dst / name).write_text(json.dumps({"fake": name}))
        (dst / "model.safetensors").write_bytes(b"\0" * 64)
        return {"lora_merged": False, "files": sorted(
            p.name for p in dst.iterdir())}

    from nmt_forge import export as export_mod
    from nmt_forge.training import backends
    from nmt_forge.training import evaluate as evaluate_mod

    monkeypatch.setattr(export_mod, "_copy_model", fake_copy)
    monkeypatch.setattr(evaluate_mod, "make_backend",
                        lambda model_cfg: backends.DummyBackend())
    out = tmp_path / "export"
    code, stdout, err = _run(capsys, "--workspace", ws_dir, "export",
                             manifest, "--config", str(cfg), "--out",
                             str(out), "--json")
    assert code == 0, stdout + err
    return {"out": out, "summary": json.loads(stdout), "ws_dir": ws_dir,
            "manifest": manifest, "cfg": cfg}


# -- 1. the deployable directory carries no corpus text ---------------------------

def test_model_dir_is_only_weights_tokenizer_settings_and_card(hf_export):
    out, summary = hf_export["out"], hf_export["summary"]
    model = out / "model"
    assert summary["model_dir"] == str(model)
    files = {p.relative_to(model).as_posix() for p in model.rglob("*")
             if p.is_file()}
    assert files == {"config.json", "generation_config.json",
                     "tokenizer.json", "tokenizer_config.json",
                     "model.safetensors", "forge-model.json", "DEPLOY.md",
                     "champollion-plugin/method.json"}
    for f in model.rglob("*"):
        if f.is_file():
            assert not _private_text_in(f), f"test text in deployable {f}"
    # every place the old layout put corpus text is gone from the export root
    assert not (out / "harness").exists() and not (out / "eval").exists()
    assert {p.name for p in out.iterdir()} == {"model", "evaluation",
                                               "README.md"}


def test_evaluation_folder_holds_the_evidence_with_the_stewards_mark(
        hf_export):
    out, summary = hf_export["out"], hf_export["summary"]
    ev = out / "evaluation"
    assert summary["evaluation_dir"] == str(ev)
    runlog = ev / "runlog.json"
    assert _private_text_in(runlog)              # it IS the evidence …
    assert summary["harness_runlog"] == str(runlog)
    assert summary["harness_report"] == str(ev / "runlog_report.json")
    # … and every text-bearing file carries the test set's terms
    for name in ("battery-hyps.jsonl", "battery-hyps-battery.json",
                 "battery-hyps-battery.md", "runlog.json",
                 "runlog_report.json", "analysis.log"):
        side = json.loads((ev / f"{name}.champollion.json").read_text())
        assert side["transmission"] == "local-only", name
        assert side["derived_from"] == "teacher_test.tsv"
        assert side["written_by"] == "nmt-forge export"
    assert summary["evaluation_mark"] == {"transmission": "local-only"}
    assert len(summary["evaluation_sidecars"]) == 6
    # the harness reads the copy's mark like the original's
    from nmt_forge import _harness

    assert _harness.corpus_terms(ev / "battery-hyps.jsonl")["meta"][
        "transmission"] == "local-only"
    readme = (ev / "README.md").read_text()
    assert "do not copy this folder with the model" in readme
    assert "transmission local-only" in readme
    root_readme = (out / "README.md").read_text()
    assert "**Never copy it with the model**" in root_readme
    assert not _private_text_in(out / "README.md")


def test_deploy_md_says_what_to_copy_and_what_never_to(hf_export):
    deploy = (hf_export["out"] / "model" / "DEPLOY.md").read_text()
    assert "self-contained, offline model" not in deploy
    head = deploy.split("## What was measured")[0]
    assert "## What to copy — and what never to copy" in head
    assert "**Never copy `../evaluation/` with the model**" in head
    assert "holds no sentence from your test set" in head
    assert "transmission local-only" in head      # the mark is named
    # the plugin manifest is installed from its own folder, never this one
    assert "plugin install " in deploy and "/champollion-plugin" in deploy
    assert "mt-eval compare ../evaluation/runlog_report.json" in deploy
    # every pair snippet: the primary, and (this test set is local-only) the
    # two machine-local fallback examples
    assert deploy.count('"acceptsInstructions": false') == 3


def test_forge_model_json_points_at_the_evidence_relative_to_itself(
        hf_export):
    out = hf_export["out"]
    fm_path = out / "model" / "forge-model.json"
    fm = json.loads(fm_path.read_text())
    assert fm["format"] == "nmt-forge-model/2"
    assert fm["model_dir"] == "."
    assert fm["test_report"]["battery_manifest"] == \
        "../evaluation/battery-hyps-battery.json"
    assert fm["harness"]["test_report"] == "../evaluation/runlog_report.json"
    assert fm["evaluation"]["deployed"] is False
    assert fm["evaluation"]["dir"] == "../evaluation"
    assert fm["serve"]["command"] == f"nmt-forge serve {out / 'model'}"
    assert (fm_path.parent / fm["test_report"]["battery_manifest"]).is_file()


def test_method_json_benchmarks_come_from_the_full_testreport(hf_export):
    method = json.loads((hf_export["out"] / "model" / "champollion-plugin"
                         / "method.json").read_text())
    assert method["type"] == "api"
    assert method["endpoint"] == "http://127.0.0.1:8378/translate"
    # a trained NMT model cannot use the gate's feedback: champollion sends a
    # refused string straight to the fallback (cli/lib/plugins.js reads this)
    assert method["acceptsInstructions"] is False
    assert "benchmarks_note" not in method, method.get("benchmarks_note")
    (entry,) = method["benchmarks"].values()
    # the harness's plugin aggregates ride along — as numbers only: lists
    # and dicts (most-missed glossary terms, register distributions) can
    # name the test set's words, and this file is in the deployable dir
    assert "hallucination.avg_hallucination_rate" in entry
    assert "terminology.most_missed_terms" not in entry
    for key, value in entry.items():
        assert value is None or isinstance(value, (bool, int, float)) or \
            key in ("date", "model", "harness_version"), key


def test_evaluate_harness_out_scores_the_same_battery_and_marks_files(
        tmp_path, capsys):
    ws_dir, manifest = _dummy_run(tmp_path, capsys)
    glossary = tmp_path / "g.json"
    glossary.write_text(json.dumps({"zorblat": ["zorbka"]}))
    code, out, err = _run(capsys, "--workspace", ws_dir, "evaluate",
                          manifest, "--glossary", str(glossary))
    assert code == 2 and "--harness-out" in err      # nothing to score it in
    h = tmp_path / "h"
    code, out, err = _run(capsys, "--workspace", ws_dir, "evaluate",
                          manifest, "--harness-out", str(h), "--glossary",
                          str(glossary), "--out-hyps",
                          str(tmp_path / "hyps.jsonl"), "--json")
    assert code == 0, err
    paths = json.loads(out)["paths"]
    assert "terminology" in paths["harness_metrics"]["computed"]
    assert paths["mark"] == {"transmission": "local-only"}
    for f in (tmp_path / "hyps.jsonl", h / "runlog.json",
              h / "runlog_report.json"):
        side = json.loads(Path(f"{f}.champollion.json").read_text())
        assert side["written_by"] == "nmt-forge evaluate"


def test_prereg_check_and_status_read_the_new_layout(hf_export, capsys):
    out, ws_dir = hf_export["out"], hf_export["ws_dir"]
    for results in (out, out / "model", out / "model" / "forge-model.json",
                    None):
        extra = ["--results", str(results)] if results else []
        code, stdout, err = _run(capsys, "--workspace", ws_dir, "prereg",
                                 "check", "p1", *extra, "--json")
        assert code == 0, stdout + err
        assert json.loads(stdout)[0]["observed"] is not None
    code, stdout, _ = _run(capsys, "--workspace", ws_dir, "status", "--json")
    advice = json.loads(stdout)["advice"]
    assert advice["state"] == "exported"
    assert advice["next_command"] == \
        f"nmt-forge serve {(out / 'model').resolve()}"


class _FakeHF:
    def __init__(self, params):
        self.params = params

    def decode(self, checkpoint, texts, params):
        return [f"<{t}>" for t in texts]


@pytest.fixture
def fake_hf(monkeypatch):
    from nmt_forge.training import backends

    monkeypatch.setattr(backends, "HFSeq2SeqBackend", _FakeHF)


def test_serve_loads_the_model_dir_from_either_path(hf_export, fake_hf):
    from nmt_forge.serve import ForgeModelServer

    out = hf_export["out"]
    for given in (out / "model", out):
        server = ForgeModelServer(given)
        assert server.dir == out / "model"
        assert Path(server.backend.params["base"]) == out / "model" / "."


def test_serve_still_reads_an_export_written_before_the_split(tmp_path,
                                                             fake_hf):
    """forge-model.json at the export root, weights in model/ (format /1)."""
    from nmt_forge.serve import ForgeModelServer

    old = tmp_path / "old-export"
    (old / "model").mkdir(parents=True)
    (old / "forge-model.json").write_text(json.dumps({
        "format": "nmt-forge-model/1", "name": "old", "model_dir": "model",
        "language": {"source": "eng", "target": "qaa"}, "decode": {}}))
    server = ForgeModelServer(old)
    assert server.dir == old
    assert Path(server.backend.params["base"]) == old / "model"


def test_serve_refuses_a_no_model_export_and_a_stray_dir(tmp_path, capsys):
    from nmt_forge.serve import ForgeModelServer

    ws_dir, manifest = _dummy_run(tmp_path, capsys)
    exp = tmp_path / "exp"
    code, _, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                        "--out", str(exp), "--no-model")
    assert code == 0, err
    with pytest.raises(ForgeError, match="--no-model"):
        ForgeModelServer(exp)
    with pytest.raises(ForgeError, match="not an nmt-forge export"):
        ForgeModelServer(tmp_path / "nowhere")


def test_a_failed_export_leaves_nothing_behind_and_keeps_an_old_one(
        tmp_path, capsys):
    ws_dir, manifest = _dummy_run(tmp_path, capsys)
    out = tmp_path / "exp"
    # no eval block in the given config → refused before anything is read
    raw = json.loads(Path(manifest).read_text())["config"]
    raw.pop("eval")
    cfg = tmp_path / "no-eval-block.json"
    cfg.write_text(json.dumps(raw))
    code, _, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                        "--config", str(cfg), "--out", str(out),
                        "--no-model")
    assert code == 2 and "no eval block" in err
    assert not out.exists()
    # a refusal before --force replaces anything leaves the old export alone
    old = tmp_path / "old"
    old.mkdir()
    (old / "keep.txt").write_text("x")
    code, _, err = _run(capsys, "--workspace", ws_dir, "export",
                        str(tmp_path / "missing.json"), "--out", str(old),
                        "--force")
    assert code == 2
    assert (old / "keep.txt").is_file()


# -- 2. the full harness battery, and what it could not compute --------------------

def test_export_scores_the_harness_battery_and_lists_what_is_missing(
        tmp_path, capsys):
    ws_dir, manifest = _dummy_run(tmp_path, capsys)
    exp = tmp_path / "exp"
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                          "--out", str(exp), "--no-model", "--json")
    assert code == 0, err
    summary = json.loads(out)
    report = json.loads(Path(summary["harness_report"]).read_text())
    plugins = report["overall"]["plugin_metrics"]
    # the behavioral plugins `mt-eval run` loads for every language
    assert {"code_switching", "hallucination", "terminology",
            "writing_style"} <= set(plugins)
    cov = summary["harness_metrics"]
    assert {"chrF++", "BLEU", "TER", "exact match", "code_switching",
            "hallucination"} <= set(cov["computed"])
    missing = {m["metric"]: m for m in cov["not_computed"]}
    # no glossary → terminology is listed, with the one command to add it
    term = missing["terminology"]
    assert "no glossary" in term["why"]
    assert term["command"].startswith("mt-eval test ")
    assert "--glossary <glossary.json>" in term["command"]
    assert str(exp / "evaluation" / "runlog.json") in term["command"]
    # … inside the TestReport too, beside the harness's own keys
    assert report["overall"]["nmt_forge_metrics_not_computed"] == \
        cov["not_computed"]
    # … and in forge-model.json
    fm = json.loads((exp / "evaluation" / "forge-model.json").read_text())
    assert fm["harness"]["metrics"] == cov
    # the human output names each missing metric
    code, text, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                           "--out", str(tmp_path / "exp2"), "--no-model")
    assert "mt-eval metrics computed: chrF++" in text
    assert "NOT computed: terminology — no glossary was given" in text
    assert "compute it: mt-eval test " in text


def test_a_glossary_turns_terminology_on(tmp_path, capsys):
    ws_dir, manifest = _dummy_run(tmp_path, capsys)
    glossary = tmp_path / "glossary.json"
    glossary.write_text(json.dumps({"zorblat": "zorbka"}))
    exp = tmp_path / "exp"
    code, out, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                          "--out", str(exp), "--no-model", "--glossary",
                          str(glossary), "--json")
    assert code == 0, err
    summary = json.loads(out)
    assert "terminology" in summary["harness_metrics"]["computed"]
    assert "terminology" not in {
        m["metric"] for m in summary["harness_metrics"]["not_computed"]}
    runlog = json.loads(Path(summary["harness_runlog"]).read_text())
    # recorded on the run, so a later `mt-eval test` scores the same terms
    assert runlog["config"]["glossary_file"] == str(glossary.resolve())
    report = json.loads(Path(summary["harness_report"]).read_text())
    term = report["overall"]["plugin_metrics"]["terminology"]
    assert term["glossary_size"] == 1 and term["total_term_total"] == 12
    # the export's own output never quotes the private set, glossary or not
    for marker in PRIVATE_MARKERS:
        assert marker not in json.dumps(summary["harness_metrics"])


def test_a_bad_glossary_or_an_unloadable_referee_refuses_before_the_read(
        tmp_path, capsys, monkeypatch):
    ws_dir, manifest = _dummy_run(tmp_path, capsys)
    ws = Workspace(ws_dir)

    def reads():
        return [e for e in ws.ledger.entries()
                if e.get("set") == "project-test"
                or e.get("eval_set") == "project-test"]

    before = len(reads())
    bad = tmp_path / "bad.json"
    bad.write_text("[1, 2]")
    code, _, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                        "--out", str(tmp_path / "e1"), "--no-model",
                        "--glossary", str(bad))
    assert code == 2 and "--glossary" in err and "no terms" in err
    assert not (tmp_path / "e1").exists()

    from mt_eval_harness import plugin_discovery

    def refuse(config, skip_fst=False, method_dir=None):
        raise RuntimeError("Eval metric 'lyss-eq' is declared on the card but "
                           "its runtime dependencies are not installed")

    monkeypatch.setattr(plugin_discovery, "discover_metric_plugins", refuse)
    code, _, err = _run(capsys, "--workspace", ws_dir, "export", manifest,
                        "--out", str(tmp_path / "e2"), "--no-model")
    assert code == 2 and "declares a referee metric" in err
    assert "nothing has been read from your test set yet" in err
    assert not (tmp_path / "e2").exists()
    assert len(reads()) == before            # no read, no spend


def _report(**overall):
    base = {"corpus_chrf": 40.0, "corpus_bleu": 10.0, "corpus_ter": 80.0,
            "exact_match_rate": 0.0, "corpus_spbleu": 9.0,
            "corpus_chrf_plain": 38.0, "comet_score": 0.5}
    base.update(overall)
    return {"overall": base}


class _P:
    def __init__(self, name):
        self.name = name


def test_metric_coverage_names_every_gap_and_its_command(tmp_path):
    from nmt_forge.harness_bridge import metric_coverage

    runlog = tmp_path / "evaluation" / "runlog.json"
    discovered = {"plugins": [_P("crk_linter"), _P("terminology"),
                              _P("hallucination")],
                  "fst_declared": True, "lang_code": "crk", "glossary": None}
    report = _report(comet_score=None, plugin_metrics={
        "crk_linter": {"unavailable": "local-only corpus: not loaded"},
        "terminology": {"avg_terminology_adherence": None},
        "hallucination": {"avg_hallucination_rate": 0.0}})
    cov = metric_coverage(report, discovered, runlog_path=runlog)
    missing = {m["metric"].split(" ")[0]: m for m in cov["not_computed"]}
    assert cov["computed"] == ["chrF++", "BLEU", "TER", "exact match",
                               "spBLEU", "chrF", "hallucination"]
    # the card lists an FST that is not installed here
    fst = missing["giellalt_fst_validity"]
    assert "not installed on this machine" in fst["why"]
    # ONE install command, the one every surface names (Round 9), then the
    # re-score of the RunLog already written
    assert fst["command"] == (f"mt-eval setup --lang crk && mt-eval test "
                              f"{runlog} --output "
                              f"{runlog.with_name('runlog_report_full.json')}")
    assert "mt-eval test` installs" not in fst["note"]
    assert "nothing downloads by itself" in fst["note"]
    # a referee the test set's terms withhold: no command, and why
    lyss = missing["crk_linter"]
    assert lyss["command"] is None and "outside service" in lyss["note"]
    assert "COMET" in missing
    assert "--glossary <glossary.json>" in missing["terminology"]["command"]


def test_metric_coverage_fst_error_points_at_the_runtime(tmp_path):
    from nmt_forge.harness_bridge import metric_coverage

    report = _report(plugin_metrics={"giellalt_fst_validity": {
        "avg_fst_validity": None,
        "error": "FST unavailable: pyhfst is not installed"}})
    cov = metric_coverage(report, {"plugins": [_P("giellalt_fst_validity")],
                                   "fst_declared": True, "lang_code": "crk"},
                          runlog_path=tmp_path / "runlog.json")
    (fst,) = cov["not_computed"]
    assert fst["why"] == "FST unavailable: pyhfst is not installed"
    assert fst["command"].startswith("mt-eval setup --lang crk && "
                                     "mt-eval test ")


def test_paths_with_spaces_are_quoted_in_commands(tmp_path):
    from nmt_forge.harness_bridge import metric_coverage

    runlog = tmp_path / "our school" / "runlog.json"
    cov = metric_coverage(_report(), {"plugins": [_P("terminology")],
                                      "glossary": None},
                          runlog_path=runlog)
    assert f"'{runlog}'" in cov["rescore_command"]


# -- 4. a busy port ------------------------------------------------------------------

def test_serve_on_a_busy_port_says_so_and_how_to_pick_another(capsys):
    holder = socket.socket()
    holder.bind(("127.0.0.1", 0))
    holder.listen(1)
    port = holder.getsockname()[1]
    try:
        # the port is checked before the model loads: no export needed
        code, out, err = _run(capsys, "serve", "some/export/model",
                              "--port", str(port))
        assert code == 2
        assert "file error" not in err
        assert f"port {port} on 127.0.0.1 is already in use" in err
        assert f"--port {port + 1}" in err
        assert f"http://127.0.0.1:{port + 1}/translate" in err
        code, out, _ = _run(capsys, "serve", "some/export/model", "--port",
                            str(port), "--json")
        assert code == 2
        assert "already in use" in json.loads(out)["error"]["message"]
    finally:
        holder.close()


def test_build_server_releases_the_port_when_the_model_fails(tmp_path):
    from nmt_forge.serve import build_server

    with pytest.raises(ForgeError, match="not an nmt-forge export"):
        build_server(tmp_path / "nowhere", port=0)
    # nothing left listening: the same port can be bound again at once
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    with pytest.raises(ForgeError, match="not an nmt-forge export"):
        build_server(tmp_path / "nowhere", port=port)
    with pytest.raises(ForgeError, match="not an nmt-forge export"):
        build_server(tmp_path / "nowhere", port=port)


# -- 5. the fallback next to the primary method --------------------------------------

def _json_blocks(markdown: str) -> list[dict]:
    return [json.loads(b) for b in
            re.findall(r"```json\n(.*?)\n```", markdown, flags=re.S)]


def test_deploy_md_shows_the_fallback_config_next_to_the_primary(hf_export):
    """An UNMARKED test set: the hosted second opinion first, the local
    option named beside it (the fixture's local-only case is below)."""
    from nmt_forge.export import fallback_section

    deploy = (hf_export["out"] / "model" / "DEPLOY.md").read_text()
    section = deploy.split("## 2a.")[1].split("## 2b.")[0]
    blocks = _json_blocks(section)
    (pair_key, primary), = blocks[0]["pairs"].items()
    assert primary == {"method": "api",
                       "endpoint": "http://127.0.0.1:8378/translate",
                       "acceptsInstructions": False}
    hosted = fallback_section(
        source_locale=blocks[0]["inputLocale"], target=pair_key.split(":")[1],
        port=8378, fallback_model=__import__(
            "nmt_forge.export", fromlist=["x"])._fallback_example_model())
    assert "If no text may leave your machines" in hosted
    blocks = blocks[:1] + _json_blocks(hosted)
    assert len(blocks) == 2
    # the champollion CLI's documented shape: the pair's own method, plus a
    # `fallback` object with its own method (configuration.md#fallback)
    fallback_pair = blocks[1]["pairs"][pair_key]
    assert fallback_pair["method"] == "api"
    assert fallback_pair["endpoint"] == primary["endpoint"]
    assert fallback_pair["fallback"]["method"] == "llm-coached"
    # the example model id is the CLI's default model, as an exact slug
    # (founder ruling 2026-10-05: no aliases) — read from the one
    # model-defaults file both runtimes read (shared/model-defaults.json,
    # role "translate"), never a literal
    import json as _json

    expected = __import__("nmt_forge.export", fromlist=["x"]).FALLBACK_EXAMPLE_MODEL
    shared = Path(__file__).resolve().parents[2] / "shared" / "model-defaults.json"
    if shared.exists():
        assert _json.loads(shared.read_text(encoding="utf-8"))["roles"]["translate"]["model"] == expected
    assert "/" in expected and not expected.startswith("~")
    assert fallback_pair["fallback"]["model"] == expected
    assert blocks[0]["inputLocale"] == blocks[1]["inputLocale"]
    assert "[FALLBACK]" in section and "OPENROUTER_API_KEY" in section
    # §4 sends the reader to it
    assert "set the pair's `fallback` (§2a)" in deploy


def test_a_local_only_projects_deploy_md_keeps_the_fallback_on_this_machine(
        hf_export):
    """Round 9 hospital persona: the test set is local-only (its sidecar),
    and DEPLOY.md offered nothing but a hosted `llm-coached` fallback. A
    local-only project now gets machine-local fallbacks first — `local`
    (an OpenAI-compatible server here) and a second `nmt-forge serve` — and
    the hosted one only as a choice for the data's owners, with why."""
    deploy = (hf_export["out"] / "model" / "DEPLOY.md").read_text()
    section = deploy.split("## 2a.")[1].split("## 2b.")[0]
    blocks = _json_blocks(section)
    assert len(blocks) == 3
    (pair_key, primary), = blocks[0]["pairs"].items()
    local = blocks[1]["pairs"][pair_key]["fallback"]
    assert local == {"method": "local", "model": "<your local model>"}
    second = blocks[2]["pairs"][pair_key]["fallback"]
    assert second == {"method": "api",
                      "endpoint": "http://127.0.0.1:8379/translate"}
    assert "your test set is marked local-only" in section
    assert "a fallback SENDS every string it gets" in section
    assert "nmt-forge serve <its export>/model --port 8379" in section
    # the hosted option is named, as the owners' choice — never as a config
    assert "llm-coached" in section and "people who own this data agree" in section
    assert not any(b["pairs"][pair_key].get("fallback", {}).get("method")
                   == "llm-coached" for b in blocks)
    assert hf_export["summary"]["fallback"] == "local"
    assert "local-only" in hf_export["summary"]["local_only"]


# -- one mark, one shape: forge's carried terms joined with the harness's ---------

def test_carried_mark_joins_the_harness_derived_file_mark(tmp_path,
                                                          monkeypatch):
    """The harness marks the files IT writes (corpus_loader.derived_mark);
    forge marks the ones it writes with the same shape, joined strictly
    with the harness's verdict — and never loosens a sidecar already there
    (mt-eval marks the TestReport during forge's analysis)."""
    from nmt_forge import _harness
    from nmt_forge.privacy import carried_mark, carry_mark, merge_marks

    corpus = tmp_path / "set.jsonl"
    corpus.write_text('{"source": "a zorblat", "target": "zorbka b"}\n')
    (tmp_path / "set.jsonl.champollion.json").write_text(
        json.dumps({"license": "LicenseRef-Our-School-Terms"}))
    # a consent-required licence: the harness withholds it and marks derived
    # files with the licence; forge carries the file's own licence
    assert _harness.derived_mark(corpus).get("license") == \
        "LicenseRef-Our-School-Terms"
    assert carried_mark(corpus) == {"license": "LicenseRef-Our-School-Terms"}

    # the harness's verdict alone can add protection the file's terms lack
    monkeypatch.setattr(_harness, "derived_mark",
                        lambda path, dataset_id="": {
                            "transmission": "local-only"})
    assert carried_mark(corpus) == {"license": "LicenseRef-Our-School-Terms",
                                    "transmission": "local-only"}

    out = tmp_path / "runlog_report.json"
    out.write_text("{}")
    Path(f"{out}.champollion.json").write_text(json.dumps(
        {"segment": "held_out", "derived_from": "runlog.json",
         "written_by": "mt-eval test"}))
    carry_mark(corpus, [out], command="export",
               mark={"transmission": "local-only"})
    side = json.loads(Path(f"{out}.champollion.json").read_text())
    assert side == {"segment": "held_out", "transmission": "local-only",
                    "derived_from": "set.jsonl", "written_by": "nmt-forge export"}
    assert merge_marks({"license": "A"}, {"license": "B", "segment": "x"}) == \
        {"license": "A", "segment": "x"}


def test_an_older_harness_without_derived_mark_still_marks(tmp_path,
                                                           monkeypatch):
    from nmt_forge import _harness
    from nmt_forge.privacy import carried_mark

    cl = _harness.corpus_loader_mod()
    monkeypatch.delattr(cl, "derived_mark", raising=False)
    corpus = tmp_path / "set.jsonl"
    corpus.write_text('{"source": "a", "target": "b"}\n')
    (tmp_path / "set.jsonl.champollion.json").write_text(
        json.dumps({"transmission": "local-only"}))
    assert _harness.derived_mark(corpus) == {}
    assert carried_mark(corpus) == {"transmission": "local-only"}


def test_exported_runlog_says_what_ran_with_source_language_and_decode_time(
        hf_export):
    """Round 5: the publish preview labelled a forge model's run "Condition:
    naive" (the LLM prompt condition), and its run card showed no usable
    source language and 0.0s elapsed (the time spent writing the log)."""
    from mt_eval_harness import publish

    ev = hf_export["out"] / "evaluation"
    runlog = json.loads((ev / "runlog.json").read_text())
    cfg = runlog["config"]
    card = runlog["provenance"]["method_card"]
    assert (card["class"], card["paradigm"]) == ("pipeline", "neural-nmt")
    assert cfg["prompt_version"] == "pipeline"
    assert cfg["source_lang"] and cfg["source_lang"] != "source"
    nf = runlog["provenance"]["nmt_forge"]
    assert nf["decode_seconds"] is not None and nf["decode_seconds"] >= 0
    assert runlog["elapsed_s"] == nf["decode_seconds"]
    assert runlog["provenance"]["dataset_meta"]["language_pair"][
        "source"] == cfg["source_code"]

    run_card, _, _ = publish.assemble_run_card(ev / "runlog_report.json")
    assert run_card["condition"] == "pipeline"
    assert publish._resolve_method_taxonomy(run_card) == {
        "method_class": "pipeline", "paradigm": "neural-nmt"}
    assert run_card["dataset"]["language_pair"].startswith(
        cfg["source_code"] + ">")
    assert run_card["elapsed_seconds"] == runlog["elapsed_s"]


def test_runlog_latency_is_the_measured_decode_time(tmp_path):
    """write_harness_report turns the measured decode into the RunLog's
    elapsed time and per-row average latency."""
    from types import SimpleNamespace

    from nmt_forge.harness_bridge import write_harness_report

    rows = [{"source": f"tok{i} zab", "reference": f"wug{i} dax"}
            for i in range(4)]
    path = tmp_path / "test.jsonl"
    path.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    entries = [{"id": str(i), "source": r["source"],
                "expected": r["reference"], "predicted": r["reference"]}
               for i, r in enumerate(rows)]
    cfg = SimpleNamespace(language={"source": "eng", "target": "qaa",
                                    "target_name": "Testlang"},
                          run_name="r", eval={}, hash=lambda: "f" * 64)
    out = write_harness_report(
        entries, out_dir=tmp_path / "ev", run_manifest={
            "run_name": "r", "config_hash": "f" * 64,
            "selected_checkpoint": "ckpt-1", "backend": "hf-scratch"},
        run_manifest_path=tmp_path / "m.json", cfg=cfg, battery="t",
        battery_entry={"path": str(path), "source_field": "source",
                       "target_field": "reference", "sha256": "x",
                       "role": "test", "rows": 4},
        discovered={"plugins": [], "log": ""}, decode_seconds=2.0,
        decode_started="2026-10-03T00:00:00+00:00")
    runlog = json.loads(Path(out["harness_runlog"]).read_text())
    assert runlog["elapsed_s"] == 2.0
    assert runlog["timestamp_start"] == "2026-10-03T00:00:00+00:00"
    assert {r["latency_s"] for r in runlog["results"]} == {0.5}
    report = json.loads(Path(out["harness_report"]).read_text())
    assert report["overall"]["avg_latency_s"] == 0.5


def test_serve_records_served_and_choose_records_the_choice(hf_export, capsys,
                                                           monkeypatch):
    """Round 5 ledgered a serve so status could point at it; Round 10 split
    the two: a serve is recorded as SERVED (a trial), and only `nmt-forge
    choose` / `serve --choose` records the user's choice."""
    from types import SimpleNamespace

    from nmt_forge import serve as serve_mod

    class _Httpd:
        server_address = ("127.0.0.1", 8378)

        def serve_forever(self):
            raise KeyboardInterrupt

        def server_close(self):
            pass

    model = SimpleNamespace(name="m", health=lambda: {"pair": "eng-qaa"})
    monkeypatch.setattr(serve_mod, "build_server",
                        lambda *a, **k: (_Httpd(), model))
    model_dir = hf_export["out"] / "model"
    code, _, _ = _run(capsys, "--workspace", hf_export["ws_dir"], "serve",
                      str(model_dir))
    assert code == 0
    ws = Workspace(hf_export["ws_dir"])
    ev = ws.ledger.find("serve")
    assert ev and ev[-1]["model_dir"] == str(model_dir.resolve())
    assert not ws.ledger.find("choose"), "a serve is not a choice"
    # serve --choose records both
    code, _, _ = _run(capsys, "--workspace", hf_export["ws_dir"], "serve",
                      str(model_dir), "--choose")
    assert code == 0
    ch = ws.ledger.find("choose")
    assert ch and ch[-1]["model_dir"] == str(model_dir.resolve())
    assert ch[-1]["via"] == "serve --choose"
    # nmt-forge choose: a recorded export only
    code, out, _ = _run(capsys, "--workspace", hf_export["ws_dir"], "choose",
                        str(model_dir), "--note", "the clinical lead",
                        "--json")
    assert code == 0
    doc = json.loads(out)
    assert doc["chosen"] == str(model_dir.resolve())
    assert doc["next"] == f"nmt-forge serve {model_dir.resolve()}"
    assert ws.ledger.find("choose")[-1]["note"] == "the clinical lead"
    code, out, _ = _run(capsys, "--workspace", hf_export["ws_dir"], "choose",
                        str(hf_export["out"]), "--json")
    assert code == 0, "the export directory itself resolves to its model/"
    code, out, _ = _run(capsys, "--workspace", hf_export["ws_dir"], "choose",
                        str(model_dir.parent.parent), "--json")
    assert code == 2
    assert "not an export this workspace recorded" in \
        json.loads(out)["error"]["text"]
