"""A server already on the port never counts as a new one (2026-10-12): an old
model server answered /health for a new `serve --detach` that could not bind,
and the rails started servers in a loop. Now the detach refuses a port that
answers, naming what is there, and a job counts as started only when its OWN
process answers."""

import argparse
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from nmt_forge.cli import _serve_detached
from nmt_forge.errors import ForgeError
from nmt_forge.jobs import _healthy


def _server(doc: dict):
    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            body = json.dumps(doc).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):
            pass

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def test_a_job_counts_as_started_only_when_its_own_process_answers():
    srv = _server({"status": "ok", "model": "old-model", "pid": 4242})
    url = f"http://127.0.0.1:{srv.server_address[1]}/health"
    try:
        assert _healthy(url) is True                    # anyone answering, when no pid is asked
        assert _healthy(url, pid=4242) is True          # its own process
        assert _healthy(url, pid=999) is False          # another forge server on the port
    finally:
        srv.shutdown()
    plain = _server({"status": "ok"})                    # a server that names no process
    try:
        assert _healthy(f"http://127.0.0.1:{plain.server_address[1]}/health", pid=999) is True
    finally:
        plain.shutdown()


def test_serve_detach_refuses_a_port_another_server_answers_on(tmp_path):
    srv = _server({"status": "ok", "model": "old-model", "pid": 4242})
    port = srv.server_address[1]
    args = argparse.Namespace(token=None, host="127.0.0.1", port=port, export_dir=str(tmp_path),
                              workspace=str(tmp_path / ".forge"), device="auto", no_hook=False,
                              choose=False, holders_agreed_by=None, allow_locale=[], job_name=None)
    try:
        with pytest.raises(ForgeError) as e:
            _serve_detached(args)
        msg = str(e.value)
        assert f"port {port} on 127.0.0.1 is already in use by the model old-model (pid 4242)" in msg
        assert "nmt-forge jobs stop" in msg and "--port" in msg
        assert not (tmp_path / ".forge" / "jobs").exists(), "no job was started"
    finally:
        srv.shutdown()
