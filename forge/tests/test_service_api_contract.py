"""service-api/1: `nmt-forge serve` answers the shared /translate vectors the
way every server must (mt-eval serve is held to the same file in the
harness's suite). The model is a stand-in — no torch — but the handler, the
health document and the locale checks are the server's own. Invented
vocabulary only."""

from __future__ import annotations

import json
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from mt_eval_harness.framework.service_api import run_vectors
from nmt_forge import serve as serve_mod
from nmt_forge.privacy import output_local_only

VECTORS = Path(__file__).resolve().parents[2] / "shared" / "test-fixtures" / "framework" / "service-api-vectors.json"


class StandIn(serve_mod.ForgeModelServer):
    """A loaded export without a model file: everything but the decode is real."""

    def __init__(self, trained_on):
        self.manifest = {"name": "family", "language": {"source": "eng", "target": "qaa"},
                         "trained_on": trained_on}
        self.name = "family"
        self.source_locales, self.target_locales = {"eng"}, {"qaa"}
        self.hook_spec, self.hook_active = None, False
        self.output_local_only = output_local_only(trained_on)

    def translate(self, texts):
        return ["zub" for _ in texts]


@pytest.mark.skipif(not VECTORS.is_file(), reason="monorepo shared/ absent")
@pytest.mark.parametrize("trained_on", [
    {"terms": {"training": "allowed"}, "recorded": "when the model was trained"},
    {"terms": {"transmission": "local-only"}, "recorded": "when the model was trained"},
    None,                                   # never recorded: counts as local-only
])
def test_nmt_forge_serve_follows_service_api_1(trained_on):
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), serve_mod.make_handler(StandIn(trained_on), None))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        vectors = json.loads(VECTORS.read_text(encoding="utf-8"))
        failures = run_vectors(f"http://127.0.0.1:{httpd.server_address[1]}", vectors,
                               source="eng", target="qaa", other="fra", word="house")
        assert failures == []
    finally:
        httpd.shutdown()
        httpd.server_close()
