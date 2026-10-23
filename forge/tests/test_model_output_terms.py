"""What a model writes is held to what it learned from (2026-10-10).

A small model repeats the sentences it was trained on. When the files it
learned from are marked local-only, its translations can carry those
sentences out — so the terms of the training files travel with the model:
the mix records them, the run manifest joins them, the export writes them
into forge-model.json and DEPLOY.md, and the server reports them on /health
and on every /translate (the rails' try_translation then shows the person
the model's own page instead of relaying its output to an agent). A model
whose training terms were never recorded counts as local-only.
"""

from __future__ import annotations

import json
import threading
import urllib.request

import pytest

from nmt_forge import serve as serve_mod
from nmt_forge.export import _trained_on_section, trained_on_terms
from nmt_forge.privacy import output_local_only, training_terms
from nmt_forge.training.config import RunConfig
from nmt_forge.training.mix import build_mix
from nmt_forge.training.run import run
from tests.conftest import write_jsonl

LOCAL = {"transmission": "local-only"}


def _mark(path, body):
    (path.parent / (path.name + ".champollion.json")).write_text(
        json.dumps(body), encoding="utf-8")


def _gold(tmp_path, name="gold.jsonl"):
    return write_jsonl(tmp_path / name, [
        {"source": f"the florp {i} sings", "target": f"florpa{i} zam"}
        for i in range(6)])


def test_the_mix_records_the_terms_of_what_it_trains_on(ws, tmp_path):
    plain = _gold(tmp_path, "plain.jsonl")
    cfg = RunConfig.from_dict({"run_name": "t", "model": {"backend": "dummy"}, "mix": {"kind_cap": None},
                               "data": {"gold": [str(plain)], "dev": "d"}})
    assert build_mix(cfg, ws).manifest["training_terms"] == {}

    family = _gold(tmp_path, "family.jsonl")
    _mark(family, LOCAL)
    cfg = RunConfig.from_dict({"run_name": "t", "model": {"backend": "dummy"}, "mix": {"kind_cap": None},
                               "data": {"gold": [str(plain), str(family)],
                                        "dev": "d"}})
    # one local-only file makes the whole mix's output local-only
    assert build_mix(cfg, ws).manifest["training_terms"] == LOCAL
    assert training_terms([plain, family]) == LOCAL


def test_the_run_manifest_carries_it(ws, dev_set, tmp_path):
    gold = _gold(tmp_path)
    _mark(gold, LOCAL)
    cfg_path = tmp_path / "config.json"
    cfg_path.write_text(json.dumps({
        "run_name": "terms", "model": {"backend": "dummy"}, "workspace": str(ws.root),
        "data": {"gold": [str(gold)], "dev": "toy-dev"},
        "mix": {"kind_cap": None}, "model": {"backend": "dummy"},
        "selection": {"metric": "loss"}, "decode": {"max_new_tokens": 16}}))
    manifest = run(cfg_path)
    assert manifest["trained_on"] == {"terms": LOCAL,
                                      "recorded": "when the model was trained"}
    on_disk = json.loads((tmp_path / "config.json").parent.joinpath(
        manifest["manifest_path"]).read_text(encoding="utf-8"))
    assert on_disk["trained_on"]["terms"] == LOCAL


def test_unrecorded_is_never_unmarked():
    assert output_local_only({"terms": {}}) is False
    assert output_local_only({"terms": {"license": "CC-BY-4.0"}}) is False
    assert output_local_only({"terms": LOCAL}) is True
    for unknown in (None, {}, {"terms": None}, "local-only"):
        assert output_local_only(unknown) is True


def test_export_reads_the_record_or_rereads_or_says_unknown(tmp_path):
    gold = _gold(tmp_path)
    cfg = RunConfig.from_dict({"run_name": "t", "model": {"backend": "dummy"},
                               "data": {"gold": [str(gold)], "dev": "d"}})
    rec = {"terms": LOCAL, "recorded": "when the model was trained"}
    assert trained_on_terms({"trained_on": rec}, cfg) == rec

    # a run from before the record: re-read from the files as they are now
    _mark(gold, LOCAL)
    again = trained_on_terms({}, cfg)
    assert again["terms"] == LOCAL and again["recorded"].startswith("at export")

    gone = RunConfig.from_dict({"run_name": "t", "model": {"backend": "dummy"}, "data": {
        "gold": [str(tmp_path / "moved.jsonl")], "dev": "d"}})
    unknown = trained_on_terms({}, gone)
    assert unknown["terms"] is None and output_local_only(unknown)


def test_deploy_md_says_it_in_words():
    assert _trained_on_section({"terms": {}, "recorded": "x"}) == ""
    local = _trained_on_section({"terms": LOCAL, "recorded": "x"})
    assert "stays on this machine" in local and "local-only" in local
    assert "GET /" in local
    unknown = _trained_on_section({"terms": None, "recorded": "unknown — y"})
    assert "stays on this machine" in unknown and "unknown" in unknown
    lic = _trained_on_section({"terms": {"license": "CC-BY-NC-4.0"}})
    assert "CC-BY-NC-4.0" in lic and "stays on this machine" not in lic


class _Model:
    name = "m"
    hook_spec = None
    hook_active = False

    def __init__(self, local):
        self.output_local_only = local

    def translate(self, texts):
        return [f"T({t})" for t in texts]

    def check_locales(self, source, target):
        return None

    def health(self):
        return {"status": "ok", "model": self.name,
                "output_local_only": self.output_local_only}


@pytest.mark.parametrize("local", [True, False])
def test_every_translate_answer_says_so(local):
    from http.server import ThreadingHTTPServer

    httpd = ThreadingHTTPServer(("127.0.0.1", 0),
                                serve_mod.make_handler(_Model(local), None))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        base = f"http://127.0.0.1:{httpd.server_address[1]}"
        req = urllib.request.Request(
            f"{base}/translate", data=json.dumps({"keys": {"a": "hi"}}).encode(),
            headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as r:
            body = json.loads(r.read())
        assert body["meta"].get("output_local_only", False) is local
        with urllib.request.urlopen(f"{base}/") as r:
            page = r.read().decode("utf-8")
        assert ("What it writes stays here" in page) is local
    finally:
        httpd.shutdown()
