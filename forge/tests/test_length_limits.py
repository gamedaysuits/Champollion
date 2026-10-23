"""Length limits are counted and said, never applied silently
(FORGE_MACHINE_CRITIQUE finding 5): training rows past max_src / max_tgt, dev
sentences cut going in, translations that stopped at the cap, and a served
request's cuts."""

import json
from pathlib import Path

from nmt_forge.advisor import length_cut_warning
from nmt_forge.serve import ForgeModelServer
from nmt_forge.training.backends import length_report
from nmt_forge.training.run import run
from tests.test_training_run import _setup


class _ByteTok:
    """A byte tokenizer, as ByT5's: one id per UTF-8 byte, plus the end."""

    def __call__(self, texts=None, text_target=None):
        rows = text_target if texts is None else texts
        return {"input_ids": [list(t.encode("utf-8")) + [1] for t in rows]}


def test_training_rows_past_the_limits_are_counted():
    rows = [{"source": "a" * 10, "target": "b" * 10},
            {"source": "a" * 400, "target": "b" * 10},
            # syllabics: three bytes a letter, so 120 letters are 361 tokens
            {"source": "short", "target": "ᓀ" * 120}]
    r = length_report(_ByteTok(), rows, 320, 320, chunk=2)
    assert r == {"rows": 3, "source_cut": 1, "target_cut": 1, "max_src": 320, "max_tgt": 320}


def test_status_says_what_was_cut_and_how_to_stop_it():
    lim = {"rows": 1000, "source_cut": 3, "target_cut": 12, "max_src": 320, "max_tgt": 320,
           "dev_decode": {"n": 100, "inputs_cut": 1, "outputs_at_cap": 2}}
    w = length_cut_warning("r1", lim)
    assert "12 of 1000 training pair(s) were longer than the model reads" in w
    assert "3 source(s) over 320 tokens, 12 translation(s) over 320" in w
    assert "1 sentence(s) were cut going in and 2 translation(s) stopped at the length cap" in w
    assert "model.max_tgt" in w and "about 100 in syllabics" in w
    assert length_cut_warning("r1", {"rows": 9, "source_cut": 0, "target_cut": 0,
                                     "dev_decode": {"inputs_cut": 0, "outputs_at_cap": 0}}) is None
    assert length_cut_warning("r1", None) is None


def test_every_run_records_its_length_cuts(ws, dev_set, tmp_path):
    m = run(_setup(ws, tmp_path))
    lim = json.loads(Path(m["manifest_path"]).read_text())["length_limits"]
    assert lim["dev_decode"] == {"n": len(dev_set), "inputs_cut": 0, "outputs_at_cap": 0}


def test_a_served_request_counts_its_cuts():
    class _Backend:
        def decode(self, ckpt, texts, params):
            self.last_decode = {"n": len(texts), "inputs_cut": [0] if len(texts) > 1 else [],
                                "outputs_at_cap": [1] if len(texts) > 1 else []}
            return ["x"] * len(texts)

    import threading

    s = ForgeModelServer.__new__(ForgeModelServer)
    s.backend, s.checkpoint, s.decode_params, s._lock = _Backend(), None, {}, threading.Lock()
    s.start_request()
    s.translate(["a", "b"])
    s.translate(["c"])
    assert s.request_cut() == {"inputs": 1, "outputs": 1}
    s.start_request()
    assert s.request_cut() == {"inputs": 0, "outputs": 0}


def test_served_text_is_nfc_as_training_text_is():
    """A decomposed ê (e + combining circumflex) is other bytes to a byte
    model: the server normalizes what it is sent, as data add normalizes
    what it trains on (plan A9)."""
    import threading
    import unicodedata
    import urllib.request
    from http.server import ThreadingHTTPServer

    from nmt_forge import serve as serve_mod

    seen = []

    class StandIn(serve_mod.ForgeModelServer):
        def __init__(self):
            self.manifest = {"name": "m", "language": {"source": "eng", "target": "qaa"}, "trained_on": None}
            self.name = "m"
            self.source_locales, self.target_locales = {"eng"}, {"qaa"}
            self.hook_spec, self.hook_active = None, False
            self.output_local_only = True

        def translate(self, texts):
            seen.extend(texts)
            return ["x" for _ in texts]

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), serve_mod.make_handler(StandIn(), None))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        body = json.dumps({"keys": {"a": "nêhiyawêwin"}}).encode()
        req = urllib.request.Request(f"http://127.0.0.1:{httpd.server_address[1]}/translate", data=body,
                                     headers={"content-type": "application/json"})
        urllib.request.urlopen(req, timeout=10).read()
    finally:
        httpd.shutdown()
    assert seen and all(unicodedata.is_normalized("NFC", t) for t in seen)
    assert "nêhiyawêwin" in seen[0]
