"""`mt-eval serve`: a method that runs here, behind the champollion
/translate contract (deployment as a service; nothing scored).

Only an in-process method is served (a caller reads a loopback endpoint as
"the text stays here"); a non-loopback bind needs a token from the
environment. Invented vocabulary only.
"""

from __future__ import annotations

import json
import shutil
import threading
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from mt_eval_harness.serve import ServeError, ServedMethod, build_server

EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def _words(tmp_path: Path) -> str:
    p = tmp_path / "words.tsv"
    p.write_text("old\tvuoras\nhouse\tviessu\n", encoding="utf-8")
    return str(p)


@pytest.fixture
def served(tmp_path):
    started = []

    def start(served_method):
        httpd = build_server(served_method, port=0)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        started.append(httpd)
        return f"http://127.0.0.1:{httpd.server_address[1]}"

    yield start
    for h in started:
        h.shutdown()
        h.server_close()


def _post(url, body, headers=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def test_a_lexicon_answers_the_translate_contract(tmp_path, served):
    base = served(ServedMethod("lexicon", model=_words(tmp_path), source="eng", target="sme"))
    status, body = _post(f"{base}/translate", {
        "source_locale": "en", "target_locale": "sme",
        "keys": {"hero.title": "an old house", "empty": "  "}})
    assert status == 207, body
    assert body["translations"] == {"hero.title": "an vuoras viessu"}
    assert body["errors"] == {"empty": {"message": "not a non-empty string"}}
    assert body["meta"]["output_gates"] == "none"
    with urllib.request.urlopen(f"{base}/health") as r:
        health = json.loads(r.read())
    assert health["runs"].startswith("in this process")
    assert health["model"].startswith("words.tsv (local file")
    assert health["license"] == "AGPL-3.0-or-later" and health["source"].startswith("https://github.com/")
    status, body = _post(f"{base}/translate", {"target_locale": "fr", "keys": {"a": "house"}})
    assert status == 400 and "translates into sme" in body["error"]["message"]


def test_what_it_writes_is_local_only_when_what_it_reads_is(tmp_path, served):
    words = _words(tmp_path)
    m = ServedMethod("lexicon", model=words, source="eng", target="sme")
    assert m.output_local_only is False
    Path(words + ".champollion.json").write_text(json.dumps({"transmission": "local-only"}))
    base = served(ServedMethod("lexicon", model=words, source="eng", target="sme"))
    with urllib.request.urlopen(f"{base}/health") as r:
        health = json.loads(r.read())
    assert health["output_local_only"] is True
    assert "marked local-only" in health["output_local_only_why"]
    status, body = _post(f"{base}/translate", {"keys": {"a": "house"}})
    assert status == 200 and body["meta"]["output_local_only"] is True
    # an unreadable mark is never read past: the dictionary is not served
    Path(words + ".champollion.json").write_text("{not json")
    with pytest.raises(ServeError, match="Could not read words.tsv.champollion.json"):
        ServedMethod("lexicon", model=words, source="eng", target="sme")


def test_local_only_output_leaves_this_machine_only_as_its_holders_agreed(tmp_path, monkeypatch):
    from mt_eval_harness import serve as serve_mod

    words = _words(tmp_path)
    Path(words + ".champollion.json").write_text(json.dumps({"transmission": "local-only"}))
    monkeypatch.setenv("MT_EVAL_SERVE_TOKEN", "s3cret-long-token")
    sm = ServedMethod("lexicon", model=words, source="eng", target="sme")
    with pytest.raises(ServeError, match="local-only .* --holders-agreed-by"):
        build_server(sm, host="0.0.0.0", port=0)
    # agreed: it binds (a stand-in socket — the test opens nothing to the network)
    bound = []
    monkeypatch.setattr(serve_mod, "ThreadingHTTPServer", lambda addr, handler: bound.append(addr) or object())
    build_server(sm, host="0.0.0.0", port=0, holders_agreed_by="the family")
    assert bound == [("0.0.0.0", 0)]
    assert sm.health()["holders_agreed_by"] == "the family"
    # this machine only: nothing to agree to
    plain = ServedMethod("lexicon", model=words, source="eng", target="sme")
    build_server(plain, host="127.0.0.1", port=0, holders_agreed_by="the family")
    assert plain.health()["holders_agreed_by"] is None


def test_a_model_folder_follows_what_forge_recorded_or_says_it_is_not_known():
    from mt_eval_harness.serve import output_local_only

    assert output_local_only({"kind": "hub", "id": "x/y"})[0] is False
    assert output_local_only(None)[0] is None


def test_a_model_folder_trained_here(tmp_path):
    from mt_eval_harness.serve import output_local_only

    d = tmp_path / "model"
    d.mkdir()
    ident = {"kind": "directory", "path": str(d)}
    assert output_local_only(ident) == (None, output_local_only(ident)[1])
    (d / "forge-model.json").write_text(json.dumps({"base": "x"}))
    assert output_local_only(ident)[0] is True          # trained here, terms never recorded
    (d / "forge-model.json").write_text(json.dumps({"trained_on": {"terms": {"transmission": "local-only"}}}))
    assert output_local_only(ident)[0] is True
    (d / "forge-model.json").write_text(json.dumps({"trained_on": {"terms": {"training": "allowed"}}}))
    assert output_local_only(ident)[0] is False


# An nmt-forge export written before 2026-10-03 (nmt-forge-model/1) keeps
# forge-model.json at the export root and the weights in model/ (model_dir
# "model"). `-m export/model` found no record and was "not known" (None):
# its translations went unmarked, unwithheld, and served to any address. Every
# /1 export predates recorded training terms (2026-10-10), so forge's own rule
# says local-only. The record is found where local_model.model_record finds it.

V1_RECORD = {"export_format": "nmt-forge-model/1", "model_dir": "model"}
ONE_UP = "its record is the export's forge-model.json, one folder up"


def _export_v1(export: Path, record) -> Path:
    """An nmt-forge-model/1 export as far as the marks go: ``record`` as the
    forge-model.json at its root (a str is written as is), and ``model/``
    with no weights — nothing here loads them. Returns ``model/``."""
    model = export / "model"
    model.mkdir(parents=True)
    (model / "config.json").write_text(json.dumps({"model_type": "marian"}))
    (export / "forge-model.json").write_text(
        record if isinstance(record, str) else json.dumps(record))
    return model


def test_an_older_exports_model_folder_is_judged_by_the_record_one_folder_up(tmp_path):
    from mt_eval_harness.methods.local_model import model_record
    from mt_eval_harness.serve import output_local_only

    export = tmp_path / "export"
    model = _export_v1(export, V1_RECORD)
    ident = {"kind": "directory", "path": str(model)}
    assert model_record(model)["file"] == str(export / "forge-model.json")
    local, why = output_local_only(ident)
    assert local is True
    assert why == f"a model trained here whose training terms were never recorded — {ONE_UP}"
    # the export root still reads its own record, as before
    assert output_local_only({"kind": "directory", "path": str(export)})[0] is True
    # what the record says decides, as for a record in the folder itself
    (export / "forge-model.json").write_text(json.dumps(
        {**V1_RECORD, "trained_on": {"terms": {"transmission": "local-only"}}}))
    assert output_local_only(ident) == (True, f"it learned from sentences marked local-only — {ONE_UP}")
    (export / "forge-model.json").write_text(json.dumps(
        {**V1_RECORD, "trained_on": {"terms": {}}}))
    assert output_local_only(ident) == (False, f"it learned from no sentences marked local-only — {ONE_UP}")


def test_a_record_one_folder_up_counts_only_when_it_names_this_folder(tmp_path):
    from mt_eval_harness.methods.base_http_mt import MTConfigError
    from mt_eval_harness.methods.local_model import model_record
    from mt_eval_harness.serve import output_local_only

    cases = {
        "another-folder": {**V1_RECORD, "model_dir": "other"},
        "no-model-dir": {"export_format": "nmt-forge-model/1"},
        "not-an-object": "[1, 2]",
    }
    for name, record in cases.items():
        model = _export_v1(tmp_path / name, record)
        assert model_record(model) == {}, name
        assert output_local_only({"kind": "directory", "path": str(model)})[0] is None, name
    # a sibling of model/ is not what the record names
    sibling = tmp_path / "another-folder" / "other-model"
    sibling.mkdir()
    assert output_local_only({"kind": "directory", "path": str(sibling)})[0] is None
    # unreadable: it may be this folder's record — a mark (model_record
    # refuses to decode beside it), never "not known"
    model = _export_v1(tmp_path / "unreadable", "{not json")
    with pytest.raises(MTConfigError, match="cannot be read"):
        model_record(model)
    assert output_local_only({"kind": "directory", "path": str(model)}) == (
        True, "the forge-model.json one folder up cannot be read (an unreadable record is a mark)")


def test_an_older_exports_model_is_served_to_this_machine_only(tmp_path, monkeypatch):
    model = _export_v1(tmp_path / "export", V1_RECORD)
    sm = ServedMethod("local-model", model=str(model), source="eng", target="sme")
    health = sm.health()
    assert health["output_local_only"] is True
    assert ONE_UP in health["output_local_only_why"]
    assert str(tmp_path) not in health["output_local_only_why"]   # /health is sent to callers
    monkeypatch.setenv("MT_EVAL_SERVE_TOKEN", "s3cret-long-token")
    with pytest.raises(ServeError, match="refusing to serve on 0.0.0.0: .*local-only .*--holders-agreed-by"):
        build_server(sm, host="0.0.0.0", port=0)


def test_only_a_method_that_runs_here_is_served(tmp_path):
    with pytest.raises(ServeError, match="sends what it translates to its service"):
        ServedMethod("google-translate", source="eng", target="fra")
    with pytest.raises(ServeError, match="neither a registered engine nor a plugin"):
        ServedMethod("google/gemini-3.8-flash", source="eng", target="fra")
    # a plugin that declares no dependency class could call an API: refused
    plugin = tmp_path / "plugin"
    shutil.copytree(EXAMPLES / "method_plugin_passthrough", plugin)
    with pytest.raises(ServeError, match="dependency class 'none'"):
        ServedMethod(str(plugin), source="eng", target="sme")
    manifest = json.loads((plugin / "method.json").read_text())
    (plugin / "method.json").write_text(json.dumps(dict(manifest, dependency_class="S")))
    assert ServedMethod(str(plugin), source="eng", target="sme").label
    with pytest.raises(ServeError, match="--pair"):
        ServedMethod("lexicon", model=_words(tmp_path), source="", target="sme")


def test_another_host_needs_a_token_and_callers_must_send_it(tmp_path, served, monkeypatch):
    sm = ServedMethod("lexicon", model=_words(tmp_path), source="eng", target="sme")
    monkeypatch.delenv("MT_EVAL_SERVE_TOKEN", raising=False)
    with pytest.raises(ServeError, match="without a token"):
        build_server(sm, host="0.0.0.0", port=0)
    monkeypatch.setenv("MT_EVAL_SERVE_TOKEN", "s3cret-long-token")
    base = served(sm)
    status, _ = _post(f"{base}/translate", {"keys": {"a": "house"}})
    assert status == 401
    status, body = _post(f"{base}/translate", {"keys": {"a": "house"}},
                         {"Authorization": "Bearer s3cret-long-token"})
    assert status == 200 and body["translations"] == {"a": "viessu"}


class _Ends:
    """A stand-in metric plugin: 1.0 when the output has no word left
    untranslated from the test dictionary, else 0.0."""
    name = "stand_in"

    def compute(self, entry):
        return {"score": 0.0 if any(w in entry["predicted"].split() for w in ("an", "the")) else 1.0}

    def aggregate(self, results):
        return {}


def _chain(on_refuse):
    return {"$schema": "https://champollion.dev/schemas/gate-chain/1.json", "id": f"words-{on_refuse}",
            "gates": [{"id": "all-words", "kind": "metric-threshold", "metric": "stand_in",
                       "field": "score", "min": 1, "on_refuse": on_refuse}]}


def test_a_gated_server_sends_only_what_its_gates_let_through(tmp_path, served):
    base = served(ServedMethod("lexicon", model=_words(tmp_path), source="eng", target="sme",
                               gate_chain=_chain("drop"), metric_plugins=[_Ends()]))
    status, body = _post(f"{base}/translate", {"keys": {"ok": "old house", "partly": "an old house"}})
    assert status == 207, body
    assert body["translations"] == {"ok": "vuoras viessu"}
    assert body["errors"] == {"partly": {"message": "refused by gate all-words (below_min)"}}
    assert body["meta"]["gates"]["refused"] == ["partly"] and body["meta"]["output_gates"] == "words-drop"
    with urllib.request.urlopen(f"{base}/health") as r:
        health = json.loads(r.read())
    assert health["output_gates"].startswith("gate chain words-drop: all-words — stand_in.score ≥ 1, else drop")
    assert health["gates"]["gates"][0]["on_refuse"] == "drop"

    keep = served(ServedMethod("lexicon", model=_words(tmp_path), source="eng", target="sme",
                               gate_chain=_chain("keep-source"), metric_plugins=[_Ends()]))
    status, body = _post(f"{keep}/translate", {"keys": {"partly": "an old house"}})
    assert status == 200 and body["translations"] == {"partly": "an old house"}
    flag = served(ServedMethod("lexicon", model=_words(tmp_path), source="eng", target="sme",
                               gate_chain=_chain("flag"), metric_plugins=[_Ends()]))
    status, body = _post(f"{flag}/translate", {"keys": {"partly": "an old house"}})
    assert body["translations"] == {"partly": "an vuoras viessu"} and body["meta"]["gates"]["flagged"] == ["partly"]


def test_a_gated_server_falls_back_to_a_bigger_dictionary(tmp_path, served):
    bigger = tmp_path / "bigger.tsv"
    bigger.write_text("an\tokta\nold\tvuoras\nhouse\tviessu\n", encoding="utf-8")
    chain = dict(_chain("fallback"), fallback={"method": "lexicon", "model": str(bigger)})
    base = served(ServedMethod("lexicon", model=_words(tmp_path), source="eng", target="sme",
                               gate_chain=chain, metric_plugins=[_Ends()]))
    status, body = _post(f"{base}/translate", {"keys": {"ok": "old house", "partly": "an old house",
                                                        "never": "the house"}})
    assert status == 207, body
    assert body["translations"] == {"ok": "vuoras viessu", "partly": "okta vuoras viessu"}
    assert body["errors"] == {"never": {"message": "refused by gate all-words (below_min); the "
                                                   "fallback's translation was refused too, by gate "
                                                   "all-words (below_min)"}}
    assert body["meta"]["gates"]["fallback"] == ["partly"]
    assert sorted(body["meta"]["gates"]["refused"]) == ["never", "partly"]
    with urllib.request.urlopen(f"{base}/health") as r:
        health = json.loads(r.read())
    assert health["gates"]["fallback"]["model"]["id"] == "bigger.tsv"
    assert "The fallback is lexicon (bigger.tsv), run here" in health["output_gates"]
    # what the fallback writes is sent too: its dictionary's mark holds
    Path(str(bigger) + ".champollion.json").write_text(json.dumps({"transmission": "local-only"}))
    from mt_eval_harness import gates as gates_mod
    gates_mod._FALLBACKS.clear()
    marked = ServedMethod("lexicon", model=_words(tmp_path), source="eng", target="sme",
                          gate_chain=chain, metric_plugins=[_Ends()])
    assert marked.output_local_only is True and "its fallback (lexicon)" in marked.output_local_only_why
    # a fallback that cannot run here stops the server from starting
    with pytest.raises(ServeError, match="its fallback cannot run here .*sends what it translates"):
        ServedMethod("lexicon", model=_words(tmp_path), source="eng", target="sme",
                     gate_chain=dict(chain, fallback={"method": "google-translate"}),
                     metric_plugins=[_Ends()])


def test_a_gate_that_cannot_judge_stops_the_server_from_starting(tmp_path):
    with pytest.raises(ServeError, match="not loaded here"):
        ServedMethod("lexicon", model=_words(tmp_path), source="eng", target="sme",
                     gate_chain=_chain("drop"), metric_plugins=[])
