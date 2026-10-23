"""Gates (founder, 2026-10-10): people bring their own per-segment checks; the
headline scores what SHIPS (the gated output), the ungated score sits beside
it, and the refusal rate is a number of its own. A gate that cannot judge
stops the run before anything is translated. Invented text only."""

from __future__ import annotations

import asyncio
import contextlib
import io
import json
from pathlib import Path

import pytest

from mt_eval_harness.config import RunConfig
from mt_eval_harness.gates import (
    GateError, apply_gates, check_gate_chain, gate_fingerprint, judge, read_gate_chain,
    resolve_gate_plugins)

SCHEMA = "https://champollion.dev/schemas/gate-chain/1.json"


def chain(*gates, cid="test-chain"):
    return {"$schema": SCHEMA, "id": cid, "gates": list(gates)}


def gate(gid="g", metric="stand_in", field="score", on_refuse="drop", **bounds):
    return {"id": gid, "kind": "metric-threshold", "metric": metric, "field": field,
            "on_refuse": on_refuse, **(bounds or {"min": 0.5})}


class StandIn:
    """A metric plugin whose per-segment value is set by the test."""
    name = "stand_in"

    def __init__(self, values, raise_on=()):
        self.values, self.raise_on = values, set(raise_on)

    def compute(self, entry):
        if entry["id"] in self.raise_on:
            raise RuntimeError("cannot score this one")
        return {"score": self.values.get(entry["id"])}

    def aggregate(self, results):
        return {}


def _results():
    return [{"id": "1", "source": "a house", "expected": "zub mol", "predicted": "zub mol"},
            {"id": "2", "source": "a dog", "expected": "zub tav", "predicted": "zub dog"},
            {"id": "3", "source": "a bird", "expected": "zub fem", "predicted": "zub fem"},
            {"id": "4", "source": "broken", "expected": "kef", "predicted": "", "error": "HTTP 500"}]


def test_the_chain_is_checked():
    assert check_gate_chain(chain(gate())) == []
    no_bound = gate()
    del no_bound["min"]
    assert any("needs min and/or max" in e for e in check_gate_chain(chain(no_bound)))
    assert any("appears twice" in e for e in check_gate_chain(chain(gate(), gate())))
    assert check_gate_chain(chain(gate(on_refuse="retry")))           # not in v1
    assert check_gate_chain({"$schema": SCHEMA, "id": "x", "gates": []})  # at least one


def test_a_value_is_judged_against_the_gate():
    assert judge(0.9, gate(min=0.5)) == ("accept", None)
    assert judge(0.1, gate(min=0.5)) == ("refuse", "below_min")
    assert judge(0.9, gate(max=0.5)) == ("refuse", "above_max")
    assert judge(None, gate()) == ("refuse", "no_value")          # unjudged never passes
    # a metric that returned NaN or infinity measured nothing: refused, never accepted
    assert judge(float("nan"), gate()) == ("refuse", "no_value")
    assert judge(float("inf"), gate()) == ("refuse", "no_value")
    assert judge(True, gate(min=1)) == ("accept", None)           # true/false read as 1/0
    assert judge(0.1, gate(on_refuse="flag", min=0.5)) == ("flag", "below_min")


def test_what_ships_and_what_is_counted():
    plugin = StandIn({"1": 0.9, "2": 0.2, "3": None})
    out, summary = apply_gates(_results(), chain(gate(min=0.5)), [plugin])
    assert [r["predicted"] for r in out[:3]] == ["zub mol", "", ""]   # dropped: nothing ships
    assert out[1]["raw_predicted"] == "zub dog", "the method's own output is kept"
    assert out[0]["gate_verdicts"] == [{"gate": "g", "verdict": "accept", "reason_code": None, "value": 0.9}]
    assert out[2]["gate_verdicts"][0]["reason_code"] == "no_value"
    assert "gate_verdicts" not in out[3], "an errored entry is not a translation"
    assert summary["judged"] == 3 and summary["refused"] == 2 and summary["accepted"] == 1
    assert summary["refusal_rate"] == round(2 / 3, 4)
    # keep-source ships the source; flag ships the output, marked, not refused
    out, s = apply_gates(_results(), chain(gate(on_refuse="keep-source", min=0.5)), [plugin])
    assert out[1]["predicted"] == "a dog"
    out, s = apply_gates(_results(), chain(gate(on_refuse="flag", min=0.5)), [plugin])
    assert out[1]["predicted"] == "zub dog" and s["flagged"] == 2 and s["refused"] == 0


def test_the_first_refusal_decides_and_a_failing_plugin_refuses():
    first = StandIn({"1": 0.9, "2": 0.1, "3": 0.9}, raise_on={"3"})
    second = StandIn({"1": 0.1, "2": 0.9, "3": 0.9})
    second.name = "second"
    c = chain(gate("a", min=0.5), gate("b", metric="second", on_refuse="keep-source", min=0.5))
    out, s = apply_gates(_results(), c, [first, second])
    assert out[0]["predicted"] == "a house" and out[0]["gate_verdicts"][1]["gate"] == "b"
    assert out[1]["predicted"] == "" and len(out[1]["gate_verdicts"]) == 1, "gate a refused first"
    assert out[2]["gate_verdicts"][0]["reason_code"] == "plugin_error:RuntimeError"
    assert s["by_gate"] == {"a": {"refused": 2, "flagged": 0, "on_refuse": "drop"},
                            "b": {"refused": 1, "flagged": 0, "on_refuse": "keep-source"}}


def test_a_gate_that_cannot_judge_stops_the_run():
    with pytest.raises(GateError, match="not loaded here"):
        resolve_gate_plugins(chain(gate(metric="nope")), [StandIn({})])
    skipped = StandIn({})
    skipped.available, skipped.reason = False, "not computed: the FST is not installed"
    with pytest.raises(GateError, match="cannot score here .*FST is not installed"):
        resolve_gate_plugins(chain(gate()), [skipped])


def test_the_fingerprint_is_the_gates_not_the_formatting(tmp_path):
    c = chain(gate())
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    a.write_text(json.dumps(c))
    b.write_text(json.dumps(c, indent=4))
    assert gate_fingerprint(read_gate_chain(a)) == gate_fingerprint(read_gate_chain(b))
    assert gate_fingerprint(chain(gate(min=0.6))) != gate_fingerprint(c)
    (tmp_path / "bad.json").write_text(json.dumps({"$schema": SCHEMA, "id": "x"}))
    with pytest.raises(GateError, match="not a valid gate-chain/1"):
        read_gate_chain(tmp_path / "bad.json")


def test_the_scorer_scores_what_ships_and_reports_the_rest():
    from mt_eval_harness.tester import analyze_run_log

    log = {"run_id": "r", "config": {}, "results": [r for r in _results() if not r.get("error")]}
    plugin = StandIn({"1": 0.9, "2": 0.2, "3": 0.9})
    with contextlib.redirect_stdout(io.StringIO()):
        plain = analyze_run_log(log, metric_plugins=[plugin], n_bootstrap_ci=50)
        gated = analyze_run_log(log, metric_plugins=[plugin], n_bootstrap_ci=50,
                                gate_chain=chain(gate(min=0.5)))
    assert "gates" not in plain["overall"], "an ungated report is unchanged"
    g = gated["overall"]["gates"]
    assert g["refused"] == 1 and g["refusal_rate"] == round(1 / 3, 4)
    assert g["ungated"]["corpus_chrf"] == plain["overall"]["corpus_chrf"], "the ungated score is the plain one"
    assert gated["overall"]["corpus_chrf"] < g["ungated"]["corpus_chrf"], "the headline is what shipped"
    entry = next(e for e in gated["entries"] if e["id"] == "2")
    assert entry["predicted"] == "" and entry["raw_predicted"] == "zub dog"
    assert entry["plugin_metrics"]["gates"]["verdicts"][0]["verdict"] == "refuse"


# --- end to end: a real run, gated on code-switching ---

def _lexicon(tmp_path):
    p = tmp_path / "words.tsv"
    p.write_text("old\tстарый\nhouse\tдом\nriver\tрека\n", encoding="utf-8")
    return p


def _corpus(tmp_path):
    c = tmp_path / "dev.json"
    c.write_text(json.dumps({
        "dataset": {"corpus_id": "gates-test", "language_pair": {"source": "eng", "target": "rus"},
                    "license": "CC-BY-4.0"},
        "entries": [{"id": "1", "source": "old house", "reference": "старый дом"},
                    {"id": "2", "source": "old river", "reference": "старая река"},
                    {"id": "3", "source": "old car", "reference": "старая машина"},
                    {"id": "4", "source": "house boat", "reference": "плавучий дом"}]}),
        encoding="utf-8")
    return c


def _chain_file(tmp_path, metric="code_switching"):
    f = tmp_path / "gates.json"
    f.write_text(json.dumps(chain({"id": "no-english-left", "kind": "metric-threshold",
                                   "metric": metric, "field": "code_switching_rate",
                                   "max": 0, "on_refuse": "drop"}, cid="no-english-left")))
    return f


def _run(tmp_path, gates):
    from mt_eval_harness.runner import execute_run
    config = RunConfig(mt_method="lexicon", method_model=str(_lexicon(tmp_path)),
                       corpus_path=str(_corpus(tmp_path)), output_dir=str(tmp_path / "out"),
                       cache_dir=str(tmp_path / "cache"), dataset="all", gate_chain=str(gates))
    with contextlib.redirect_stdout(io.StringIO()):
        return asyncio.run(execute_run(config))


def test_a_real_run_is_scored_gated(tmp_path):
    log = _run(tmp_path, _chain_file(tmp_path))
    assert log["config"]["gate_chain"].endswith("gates.json"), "the run records its gates"
    report = json.loads(next((tmp_path / "out").glob("*_report.json")).read_text())
    g = report["overall"]["gates"]
    assert g["chain_id"] == "no-english-left"
    assert g["refused"] == 2, "'old car' and 'house boat' leave English words in"
    by_id = {e["id"]: e for e in report["entries"]}
    assert by_id["3"]["predicted"] == "" and by_id["3"]["raw_predicted"] == "старый car"
    assert by_id["1"]["predicted"] == "старый дом"


def test_a_gate_whose_plugin_is_missing_stops_the_run_before_translating(tmp_path):
    with pytest.raises(ValueError, match="not loaded here"):
        _run(tmp_path, _chain_file(tmp_path, metric="no_such_plugin"))
    assert not list((tmp_path / "out").glob("*.json")), "nothing was translated or written"


def test_a_gated_run_publishes_its_gates_and_a_different_identity(tmp_path):
    from mt_eval_harness.publish import assemble_run_card
    from mt_eval_harness.tester import analyze_run

    _run(tmp_path, _chain_file(tmp_path))
    report_path = next((tmp_path / "out").glob("*_report.json"))
    log_path = next(p for p in (tmp_path / "out").glob("*.json") if not p.name.endswith("_report.json"))
    with contextlib.redirect_stdout(io.StringIO()):
        card, _, _ = assemble_run_card(report_path)
        plain_report = tmp_path / "plain_report.json"
        analyze_run(log_path, output_path=str(plain_report), n_bootstrap_ci=50)
        plain_card, _, _ = assemble_run_card(plain_report)
    s = card["scores"]
    assert s["gates"]["chain_id"] == "no-english-left" and s["gates"]["refused"] == 2
    assert s["ungated_chrf_plus_plus"] == plain_card["scores"]["chrf_plus_plus"]
    assert s["chrf_plus_plus"] < s["ungated_chrf_plus_plus"]
    assert card["fingerprint"]["components"]["gate_chain_sha256"] == s["gates"]["fingerprint"]
    assert "gate_chain_sha256" not in plain_card["fingerprint"]["components"]
    assert card["fingerprint"]["hash"] != plain_card["fingerprint"]["hash"]
    assert "gates" not in plain_card["scores"]


# --- the fallback: what a gate refuses, a dictionary (or local model) tries ---

class NoEnglish:
    """A stand-in plugin: 1.0 unless the output keeps one of a few English words."""
    name = "stand_in"

    def compute(self, entry):
        return {"score": 0.0 if set(entry["predicted"].split()) & {"dog", "bird", "cat"} else 1.0}

    def aggregate(self, results):
        return {}


class Fallback:
    """A stand-in fallback: a fixed answer per source (or an error)."""
    label, identity, output_local_only = "stand-in", {"id": "words.tsv", "kind": "file", "sha256": "ab"}, False

    def __init__(self, answers):
        self.answers, self.calls = answers, []

    def translate(self, texts):
        self.calls.append(list(texts))
        return [self.answers.get(t, ("", "no entry")) for t in texts]


def test_a_chain_that_falls_back_must_name_its_fallback():
    assert any("needs the chain's fallback" in e
               for e in check_gate_chain(chain(gate(on_refuse="fallback"))))
    ok = dict(chain(gate(on_refuse="fallback")), fallback={"method": "lexicon", "model": "w.tsv"})
    assert check_gate_chain(ok) == []
    with pytest.raises(GateError, match="not loaded here"):
        apply_gates(_results(), ok, [NoEnglish()])           # named, but not loaded


def test_the_fallback_fills_what_a_gate_refuses_and_the_same_gates_judge_it():
    from mt_eval_harness.gates import refusal_message

    results = [{"id": "1", "source": "a house", "predicted": "zub mol"},
               {"id": "2", "source": "a dog", "predicted": "zub dog"},
               {"id": "3", "source": "a bird", "predicted": "zub bird"},
               {"id": "4", "source": "a cat", "predicted": "zub cat"}]
    fb = Fallback({"a dog": ("zub tav", None), "a bird": ("zub bird", None)})
    c = dict(chain(gate(on_refuse="fallback", min=0.5)), fallback={"method": "lexicon", "model": "w.tsv"})
    out, s = apply_gates(results, c, [NoEnglish()], fallback=fb)
    assert fb.calls == [["a dog", "a bird", "a cat"]], "one call, only the refused segments"
    assert [(r["predicted"], r["shipped_from"]) for r in out] == [
        ("zub mol", "method"), ("zub tav", "fallback"), ("", "nothing"), ("", "nothing")]
    assert out[1]["raw_predicted"] == "zub dog", "the method's own output is kept"
    assert out[1]["fallback"]["verdicts"][0]["verdict"] == "accept"
    assert refusal_message(out[2]) == ("refused by gate g (below_min); the fallback's translation "
                                       "was refused too, by gate g (below_min)")
    assert refusal_message(out[3]) == "refused by gate g (below_min); the fallback could not translate it (no entry)"
    # the refusal rate is the METHOD's; what shipped instead is counted apart
    assert s["refused"] == 3 and s["refusal_rate"] == 0.75
    assert s["shipped_from"] == {"method": 1, "source": 0, "fallback": 1, "nothing": 2}
    assert {k: s["fallback"][k] for k in ("tried", "shipped", "refused", "failed")} == \
        {"tried": 3, "shipped": 1, "refused": 1, "failed": 1}
    assert s["fallback"]["model"] == {"id": "words.tsv", "kind": "file", "sha256": "ab"}


def test_a_fallback_that_fails_ships_nothing():
    class Broken(Fallback):
        def translate(self, texts):
            raise RuntimeError("out of memory")

    c = dict(chain(gate(on_refuse="fallback", min=0.5)), fallback={"method": "lexicon", "model": "w.tsv"})
    out, s = apply_gates([{"id": "2", "source": "a dog", "predicted": "zub dog"}], c, [NoEnglish()],
                         fallback=Broken({}))
    assert out[0]["predicted"] == "" and out[0]["fallback"] == {"error": "RuntimeError"}
    assert s["fallback"]["failed"] == 1 and s["shipped_from"]["nothing"] == 1


def test_only_a_fallback_that_runs_here_is_loaded(tmp_path):
    from mt_eval_harness.gates import make_fallback

    remote = dict(chain(gate(on_refuse="fallback")), fallback={"method": "google-translate"})
    with pytest.raises(GateError, match="cannot run here .*sends what it translates"):
        make_fallback(remote, "eng", "rus")
    missing = dict(chain(gate(on_refuse="fallback")),
                   fallback={"method": "lexicon", "model": str(tmp_path / "nope.tsv")})
    with pytest.raises(GateError, match="no such file"):
        make_fallback(missing, "eng", "rus")
    with pytest.raises(GateError, match="needs the pair"):
        make_fallback(dict(missing, fallback={"method": "lexicon", "model": str(_lexicon(tmp_path))}), "", "rus")
    assert make_fallback(chain(gate()), "eng", "rus") is None, "no gate falls back: nothing loaded"
    loaded = make_fallback(dict(missing, fallback={"method": "lexicon", "model": str(_lexicon(tmp_path))}),
                           "eng", "rus")
    assert loaded.label == "lexicon" and loaded.translate(["old house"]) == [("старый дом", None)]


def _fallback_chain_file(tmp_path, fallback_model):
    f = tmp_path / "gates-fb.json"
    f.write_text(json.dumps(dict(chain({"id": "no-english-left", "kind": "metric-threshold",
                                        "metric": "code_switching", "field": "code_switching_rate",
                                        "max": 0, "on_refuse": "fallback"}, cid="no-english-left"),
                                 fallback={"method": "lexicon", "model": str(fallback_model)})))
    return f


def test_a_run_refuses_a_chain_that_falls_back(tmp_path):
    """A measurement never blends two methods (founder, 2026-10-11): with a
    fallback, the gated headline would score segments the fallback wrote
    under the method's name. `run` refuses the chain before translating
    anything; translate and serve still use it (test_translate_command,
    test_serve_method, test_deployment)."""
    from mt_eval_harness.gates import refuse_fallback_in_measurement

    bigger = tmp_path / "bigger.tsv"
    bigger.write_text("old\tстарый\nhouse\tдом\nriver\tрека\ncar\tмашина\n", encoding="utf-8")
    chain_file = _fallback_chain_file(tmp_path, bigger)
    with pytest.raises(ValueError, match="never for a measurement"):
        _run(tmp_path, chain_file)
    assert not list((tmp_path / "out").glob("*.json")), "nothing was translated or written"
    # the scorer refuses it too, whoever calls it
    with pytest.raises(GateError, match="partly this method's and partly the fallback's"):
        refuse_fallback_in_measurement(json.loads(chain_file.read_text()))
    refuse_fallback_in_measurement(chain(gate()))          # drop / keep-source / flag: measured


def test_a_glossary_gate_accepts_a_sentence_with_no_glossary_term():
    """Docs review 2026-10-12 (#9): a terminology gate refused every segment
    whose source holds no glossary term — a missing value read as a failure,
    where there was nothing to judge."""
    from mt_eval_harness.gates import _run_chain
    from mt_eval_harness.plugins.terminology import TerminologyPlugin

    plugin = TerminologyPlugin(glossary={"river": ["река"]})
    g = {"id": "terms", "kind": "metric-threshold", "metric": "terminology", "field": "terminology_adherence",
         "min": 1.0, "on_refuse": "drop"}
    c = {"id": "glossary", "gates": [g]}
    seg = lambda src, out: {"id": "1", "source": src, "predicted": out, "raw_predicted": out}  # noqa: E731
    verdicts, refused = _run_chain(seg("good morning", "доброе утро"), c, {"terms": plugin})
    assert refused is None and verdicts[0]["verdict"] == "accept" and verdicts[0]["reason_code"] == "not_applicable"
    verdicts, refused = _run_chain(seg("the river", "озеро"), c, {"terms": plugin})
    assert refused is g and verdicts[0]["reason_code"] == "below_min"
    verdicts, refused = _run_chain(seg("the river", "река"), c, {"terms": plugin})
    assert refused is None


def test_mt_eval_test_refuses_a_chain_that_falls_back_cleanly(tmp_path, monkeypatch, capsys):
    """Docs review 2026-10-12 (#8): `mt-eval test --gates <a chain with a
    fallback>` crashed with a traceback from inside run_test; it refuses
    with the reason and exit 1, before scoring anything."""
    import sys

    from mt_eval_harness.cli import main

    _run(tmp_path, _chain_file(tmp_path))                  # a real run log to re-score
    log = next(p for p in (tmp_path / "out").glob("*.json") if not p.name.endswith("_report.json"))
    bigger = tmp_path / "bigger.tsv"
    bigger.write_text("old\tстарый\nhouse\tдом\n", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["mt-eval", "test", str(log), "--gates",
                                      str(_fallback_chain_file(tmp_path, bigger)),
                                      "--output", str(tmp_path / "rescored.json")])
    with pytest.raises(SystemExit) as e:
        main()
    assert e.value.code == 1
    assert "never for a measurement" in capsys.readouterr().err
    assert not (tmp_path / "rescored.json").exists()


def test_the_script_check_never_passes_what_it_could_not_check():
    """No reference to read the target's script from (translate, serve) and
    none named: code_switching gives no rate, and a gate over it is refused
    before anything runs. A run with references is judged as before."""
    from mt_eval_harness.plugin_discovery import _load_code_switching

    blind = _load_code_switching({"target_code": "rus"})          # Cyrillic and Latin on its card
    assert blind.compute({"source": "old car", "predicted": "старый car"})["code_switching_rate"] is None
    assert blind.aggregate([{"code_switching_rate": None, "cs_unjudged": "no_target_script"}]) == \
        {"entries_unjudged": 1}
    cs_gate = gate(metric="code_switching", field="code_switching_rate", max=0)
    with pytest.raises(GateError, match="cannot judge a translation without a reference.*--target-script"):
        resolve_gate_plugins(chain(cs_gate), [blind], references=False)
    resolve_gate_plugins(chain(cs_gate), [blind])                  # a run has references
    named = _load_code_switching({"target_code": "rus", "target_script": "Cyrl"})
    assert named.compute({"source": "old car", "predicted": "старый car"})["code_switching_rate"] == 0.5
    one_script = _load_code_switching({"target_code": "sme"})     # its card lists Latin only
    assert one_script.unjudged_without_references() is None
    # with a reference, the reference decides, as it always has
    ref = _load_code_switching({"target_code": "rus"})
    assert ref.compute({"source": "old car", "predicted": "старый car",
                        "expected": "старая машина"})["code_switching_rate"] == 0.5


def test_a_fallback_that_cannot_run_stops_translate_before_translating(tmp_path):
    from mt_eval_harness.runner import execute_run

    config = RunConfig(mt_method="lexicon", method_model=str(_lexicon(tmp_path)),
                       corpus_path=str(_corpus(tmp_path)), output_dir=str(tmp_path / "out"),
                       cache_dir=str(tmp_path / "cache"), dataset="all", translate_only=True,
                       gate_chain=str(_fallback_chain_file(tmp_path, tmp_path / "missing.tsv")))
    with pytest.raises(ValueError, match="its fallback cannot run here"):
        with contextlib.redirect_stdout(io.StringIO()):
            asyncio.run(execute_run(config))
    assert not list((tmp_path / "out").glob("*.json")), "nothing was translated or written"
