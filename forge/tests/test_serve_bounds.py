"""Serving bounds (program plan A12; FORGE_MACHINE_CRITIQUE finding 12): the
model is asked a chunk at a time, the lock taken per chunk, so one sentence
never waits behind a whole 5,000-piece request; a request past its time
bound is refused whole; a server started while this project trains takes
the CPU rather than share the GPU."""

import json
import os
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from nmt_forge import serve as serve_mod
from nmt_forge.serve import ForgeModelServer, _training_running


class _Backend:
    def __init__(self):
        self.sizes = []

    def decode(self, ckpt, texts, params):
        self.sizes.append(len(texts))
        self.last_decode = {"n": len(texts), "inputs_cut": [], "outputs_at_cap": []}
        return [f"x{t}" for t in texts]


def _server():
    s = ForgeModelServer.__new__(ForgeModelServer)
    s.backend, s.checkpoint, s.decode_params, s._lock = _Backend(), None, {}, threading.Lock()
    return s


def test_the_model_is_asked_a_chunk_at_a_time():
    s = _server()
    out = s.translate([str(i) for i in range(70)])
    assert out == [f"x{i}" for i in range(70)]
    assert s.backend.sizes == [32, 32, 6]


def test_a_request_past_its_time_is_refused_whole(monkeypatch):
    monkeypatch.setattr(serve_mod, "REQUEST_SECONDS", -1)
    with pytest.raises(TimeoutError, match="send fewer pieces at a time"):
        _server().translate(["a", "b"])


def test_the_refusal_is_a_503_never_a_partial_answer():
    class StandIn(ForgeModelServer):
        def __init__(self):
            self.manifest = {"name": "m", "language": {"source": "eng", "target": "qaa"}, "trained_on": None}
            self.name = "m"
            self.source_locales, self.target_locales = {"eng"}, {"qaa"}
            self.hook_spec, self.hook_active = None, False
            self.output_local_only = True

        def translate(self, texts):
            raise TimeoutError("the request took longer than 600 s — send fewer pieces at a time")

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), serve_mod.make_handler(StandIn(), None))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{httpd.server_address[1]}/translate",
                                     data=json.dumps({"keys": {"a": "hello"}}).encode(),
                                     headers={"content-type": "application/json"})
        with pytest.raises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(req, timeout=10)
        assert e.value.code == 503
        body = json.loads(e.value.read())
        assert "send fewer pieces" in body["error"]["message"] and "translations" not in body
    finally:
        httpd.shutdown()


def test_a_server_started_while_the_project_trains_takes_the_cpu(tmp_path):
    proj = tmp_path / "p"
    job = proj / ".forge" / "jobs" / "train-1"
    job.mkdir(parents=True)
    (job / "job.json").write_text(json.dumps({"name": "train-1", "kind": "train", "created": 0}))
    (job / "supervisor.pid").write_text(str(os.getpid()))           # a live process: training
    export = proj / "export" / "run" / "model"
    export.mkdir(parents=True)
    assert _training_running(export) is True
    (job / "exit.json").write_text(json.dumps({"outcome": "finished"}))
    assert _training_running(export) is False
    assert _training_running(tmp_path / "elsewhere") is False
