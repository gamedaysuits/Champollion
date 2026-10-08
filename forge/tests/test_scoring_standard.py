"""The scoring standard ("standard/1", founder 2026-10-04: "we want scoring
to be industry standard") on every forge surface, and Round 14's open lint
item.

1. The headline is corpus chrF++ with its 95% bootstrap CI, written the way
   the harness writes it (``chrF++ 47.5 [45.9, 49.0]``), with its sacreBLEU
   signature wherever a full record is written (forge-model.json, the export
   summary, DEPLOY.md). BLEU/spBLEU/TER/COMET sit beside it, never blended;
   exact match and referee lanes are labelled diagnostics. No surface
   prints a composite or a quality tier.
2. Round 14 (S2): ``forge_lint`` / ``nmt-forge lint`` given a RUN manifest
   reported "0 findings" for the model whose score carries a MAJOR mt-eval
   caveat. A run manifest now lints the battery of each of the run's scored
   exports — the caveat relayed beside the headline — and a run with no
   scored export is refused with the exact export command.

All text is invented tokens (quarantine-gate discipline).
"""

from __future__ import annotations

import contextlib
import json
import re

import pytest

from nmt_forge import scoring_standard as std
from tests.test_private_text import _run
from tests.test_round13_forge import _Cap, _build, _project

#: the standard's headline, as format_primary writes it
HEADLINE = re.compile(r"chrF\+\+ \d+\.\d \[\d+\.\d, \d+\.\d\]")

#: what a retired composite or quality tier would look like on a surface
RETIRED = re.compile(r"composite|quality[ _-]?tier|qualityTier|"
                     r"\b(emerging|functional|fluent)\b", re.IGNORECASE)


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    """The Round 13 workspace: an all-data export, and a twin-free export
    whose output mt-eval flags as near-constant (a MAJOR caveat)."""
    return _build(tmp_path_factory.mktemp("standard"))


# -- 1. the headline -----------------------------------------------------------

def test_score_line_leads_with_chrf_and_labels_the_rest():
    line = std.score_line({
        "exact_match": {"score": 0.1, "ci_lower": 0.0, "ci_upper": 0.2},
        "bleu": {"score": 21.34, "ci_lower": 19.0, "ci_upper": 23.5},
        "chrf++": {"score": 47.49, "ci_lower": 45.91, "ci_upper": 49.02}})
    assert line.startswith("chrF++ 47.5 [45.9, 49.0] 95% CI")
    assert "beside it: BLEU 21.3 [19.0, 23.5]" in line
    assert "diagnostics (never a headline): exact match 0.10 [0.00, 0.20]" \
        in line
    # under a headline that already gives chrF++: the rest only, or nothing
    assert std.score_line({"chrf++": {"score": 1.0}}, primary=False) == ""
    assert not RETIRED.search(line)


def test_the_headline_is_the_test_reports_corpus_chrf_with_ci_and_signature():
    h = std.from_test_report({"overall": {
        "corpus_chrf": 47.49, "corpus_bleu": 21.3, "corpus_ter": 61.2,
        "confidence_intervals": {"corpus_chrf": {"ci_lower": 45.91,
                                                 "ci_upper": 49.02}},
        "sacrebleu_signatures": {"chrf": "nrefs:1|case:mixed|nc:6|nw:2"}}})
    assert h["text"] == "chrF++ 47.5 [45.9, 49.0]"
    assert h["scoring_standard"] == "standard/1"
    assert h["metric"] == "chrf_plus_plus"
    assert h["signature"] == "nrefs:1|case:mixed|nc:6|nw:2"
    assert h["secondary_text"] == "BLEU 21.3 · TER 61.2"
    # a battery without chrF++ never promotes another metric to headline
    assert std.from_scores({"bleu": {"score": 9.0}})["text"] == "chrF++ —"


def test_every_export_surface_quotes_chrf_with_ci_and_no_composite(
        built, capsys):
    nt = built["nt"]
    summary = built["nt_sum"]
    h = summary["headline"]
    assert HEADLINE.fullmatch(h["text"]) and h["signature"]
    assert h["scoring_standard"] == "standard/1"
    assert h["from"].startswith("mt-eval TestReport")
    # the TestReport the export wrote is where the number comes from
    report = json.loads((nt / "evaluation" / "runlog_report.json")
                        .read_text())
    assert h["score"] == report["overall"]["corpus_chrf"]
    ci = report["overall"]["confidence_intervals"]["corpus_chrf"]
    assert [h["ci_lower"], h["ci_upper"]] == [ci["ci_lower"], ci["ci_upper"]]
    # forge-model.json records the full headline
    fm = json.loads((nt / "model" / "forge-model.json").read_text())
    assert fm["test_report"]["headline"] == h
    assert fm["test_report"]["scoring_standard"] == "standard/1"
    # DEPLOY.md: the headline in bold first, with its signature
    deploy = (nt / "model" / "DEPLOY.md").read_text()
    measured = deploy.split("## What was measured", 1)[1].split("## 1.", 1)[0]
    first = next(p for p in measured.split("\n\n") if p.startswith("Test set"))
    assert f"**{h['text']}**" in first and h["signature"] in first
    assert "95% bootstrap CI" in first
    # status and report quote the same number
    code, out, _ = _run(capsys, "--workspace", built["ws_dir"], "status",
                        "--json")
    exports = json.loads(out)["advice"]["exports"]
    assert {x["score"]["text"] for x in exports if x["run"] == "notwins"} \
        == {h["text"]}
    code, rep, _ = _run(capsys, "--workspace", built["ws_dir"], "report",
                        built["runs"]["notwins"]["manifest"])
    assert f"- **headline: {h['text']}" in rep
    for text in (json.dumps(summary), json.dumps(fm), measured, out, rep):
        assert not RETIRED.search(text), RETIRED.search(text)


def test_the_export_text_summary_leads_with_the_headline(tmp_path):
    """`nmt-forge export` without --json: the headline line comes first,
    with its signature; chrF++ is not printed twice under it."""
    from nmt_forge import export as export_mod
    from nmt_forge.training import backends
    from nmt_forge.training import evaluate as evaluate_mod

    def fake_copy(src, dst, model_cfg):
        dst.mkdir(parents=True, exist_ok=True)
        (dst / "config.json").write_text("{}")
        (dst / "model.safetensors").write_bytes(b"\0" * 64)
        return {"lora_merged": False, "files": ["config.json"]}

    cap = _Cap()
    with pytest.MonkeyPatch.context() as mp, \
            contextlib.redirect_stdout(cap.o), \
            contextlib.redirect_stderr(cap.e):
        ws_dir, runs = _project(tmp_path, cap)
        mp.setattr(export_mod, "_copy_model", fake_copy)
        mp.setattr(evaluate_mod, "make_backend",
                   lambda model_cfg: backends.DummyBackend())
        code, out, err = _run(cap, "--workspace", ws_dir, "export",
                              runs["notwins"]["manifest"], "--config",
                              str(runs["notwins"]["cfg"]), "--prereg",
                              "notwins", "--out", str(tmp_path / "exp"))
    assert code == 0, out + err
    line = next(ln for ln in out.splitlines()
                if ln.startswith("  headline: "))
    assert HEADLINE.search(line) and "scoring standard/1" in line
    assert "sacreBLEU signature: nrefs:" in out
    assert len(HEADLINE.findall(out.split("evaluation (your test", 1)[0])) \
        == 1
    assert not RETIRED.search(out)


# -- 2. lint on a run manifest (Round 14) --------------------------------------

def test_lint_on_a_run_manifest_relays_the_major_caveat_with_the_headline(
        built, capsys):
    manifest = built["runs"]["notwins"]["manifest"]
    code, out, err = _run(capsys, "--workspace", built["ws_dir"], "lint",
                          manifest, "--json")
    assert code == 0, err
    findings = json.loads(out)
    r9 = [f for f in findings if f["rule"] == "R9-harness-score-caveat"]
    assert len(r9) == 1 and r9[0]["severity"] == "high"
    assert r9[0]["evidence"]["kind"] == "near_constant_output"
    headline = built["nt_sum"]["headline"]["text"]
    assert r9[0]["evidence"]["headline"] == headline
    assert f"qualifies the headline score, {headline}:" in \
        r9[0]["recommendation"]
    assert r9[0]["evidence"]["export"] == built["nt_sum"]["export_dir"]
    assert r9[0]["evidence"]["battery_manifest"].endswith(
        "evaluation/battery-hyps-battery.json")
    # the text names the export, its headline, and the caveat
    code, text, _ = _run(capsys, "--workspace", built["ws_dir"], "lint",
                         manifest)
    assert f"test set project-test (n=12): {headline}" in text
    assert "⚠ SCORE CAVEAT (mt-eval-harness)" in text
    assert "[high] R9-harness-score-caveat" in text


def test_lint_on_a_run_manifest_keeps_the_run_signals_and_the_twin_reading(
        built, capsys):
    code, out, _ = _run(capsys, "--workspace", built["ws_dir"], "lint",
                        built["runs"]["all-data"]["manifest"], "--json")
    assert code == 0
    rules = [f["rule"] for f in json.loads(out)]
    assert "R4-recall-not-translation" in rules


def test_lint_on_an_unexported_run_manifest_refuses_with_the_export_command(
        tmp_path, capsys):
    cap = _Cap()
    with contextlib.redirect_stdout(cap.o), contextlib.redirect_stderr(cap.e):
        ws_dir, runs = _project(tmp_path, cap)
    manifest = runs["notwins"]["manifest"]
    code, out, _ = _run(capsys, "--workspace", ws_dir, "lint", manifest,
                        "--json")
    assert code == 2
    text = json.loads(out)["error"]["text"]
    assert "is a run manifest, not a battery manifest" in text
    assert f"nmt-forge export {manifest} --out " in text
    assert "/evaluation/battery-hyps-battery.json --run-manifest" in text
    assert "0 findings" not in text
