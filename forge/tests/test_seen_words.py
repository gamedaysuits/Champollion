"""The words a model never saw are named (stress test 4, 2026-10-13): on G1's
outputs a sentence holding a content word the model never saw in training was
right 0 times in 358, and confidently wrong 32–83% of the time."""

import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer

from nmt_forge import serve as serve_mod
from nmt_forge.export import NOT_IN_A_CONTEST_ENTRY
from nmt_forge.seen_words import SEEN_WORDS, UNSEEN_NOTE, SeenWords, tokens, write_seen_words
from nmt_forge.serve import ForgeModelServer, UNSEEN_UNAVAILABLE


def test_words_are_letter_runs_in_any_script_lowercased_once_each(tmp_path):
    assert tokens("The dog’s 3 BONES, nêhiyawêwin ᓀᐦᐃᔭᐍᐏᐣ!") == ["the", "dog's", "bones", "nêhiyawêwin", "ᓀᐦᐃᔭᐍᐏᐣ"]
    r = write_seen_words(tmp_path, ["The dog sleeps.", "We walked home."], english=True, notes=["x.tsv: changed"])
    assert r == {"words": 6, "sentences": 2, "file": SEEN_WORDS}
    doc = json.loads((tmp_path / SEEN_WORDS).read_text())
    assert doc["words"] == ["dog", "home", "sleeps", "the", "walked", "we"] and doc["notes"] == ["x.tsv: changed"]


def test_an_english_ending_of_a_seen_word_counts_as_seen_and_other_scripts_match_exactly(tmp_path):
    write_seen_words(tmp_path, ["The dog sleeps.", "We walk home."], english=True)
    seen = SeenWords.load(tmp_path)
    assert seen.unseen("The dogs walked home with a fox, a fox!") == ["with", "a", "fox"]
    write_seen_words(tmp_path, ["nipâw atim"], english=False)
    assert SeenWords.load(tmp_path).unseen("nipâw atimwak") == ["atimwak"]
    assert SeenWords.load(tmp_path / "none") is None


class _Model(ForgeModelServer):
    def __init__(self, seen):
        self.manifest = {"name": "m", "language": {"source": "eng", "target": "qaa"}, "trained_on": None}
        self.name = "m"
        self.source_locales, self.target_locales = {"eng"}, {"qaa"}
        self.hook_spec, self.hook_active = None, False
        self.output_local_only = False
        self.seen_words = seen

    def translate(self, texts):
        return [f"x {t}" for t in texts]


def _post(model, keys, route="/translate"):
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), serve_mod.make_handler(model, None))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    body = ({"keys": keys} if route == "/translate"
            else {"messages": [{"role": "user", "content": json.dumps(keys, indent=2)}]})
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{httpd.server_address[1]}{route}",
                                     data=json.dumps(body).encode(),
                                     headers={"content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    finally:
        httpd.shutdown()


def test_the_chat_route_names_them_by_the_callers_keys(tmp_path):
    # the CLI's local method sends an app's strings this way
    write_seen_words(tmp_path, ["The dog sleeps."], english=True)
    d = _post(_Model(SeenWords.load(tmp_path)), {"greeting": "The dog sleeps.", "farewell": "Goodbye, dog."},
              route="/v1/chat/completions")
    assert d["meta"]["unseen_words"] == {"farewell": ["goodbye"]}


def test_each_reply_names_the_words_of_a_sentence_the_model_never_saw(tmp_path):
    write_seen_words(tmp_path, ["The dog sleeps.", "We walk home."], english=True)
    model = _Model(SeenWords.load(tmp_path))
    d = _post(model, {"a": "The dog sleeps.", "b": "The fox walked home."})
    assert d["meta"]["unseen_words"] == {"b": ["fox"]}
    assert d["meta"]["unseen_note"] == UNSEEN_NOTE
    h = model.health()["unseen_words_check"]
    assert h["on"] is True and h["words_seen"] == 6
    assert "unseen_words" not in _post(model, {"a": "We walk."})["meta"], "nothing to name: nothing said"


def test_an_export_without_the_record_says_it_cannot_check():
    model = _Model(None)
    d = _post(model, {"a": "The fox."})
    assert d["meta"]["unseen_check"] == UNSEEN_UNAVAILABLE and "unseen_words" not in d["meta"]
    assert model.health()["unseen_words_check"] == {"on": False, "why": UNSEEN_UNAVAILABLE}


def test_the_try_page_shows_the_words_as_text():
    assert SEEN_WORDS not in NOT_IN_A_CONTEST_ENTRY, "it is never in model/ to leave out"
    page = serve_mod._try_page({"pair": "eng→qaa", "model": "m"}, token_required=False)
    assert "Never seen in training: " in page and "unseen_words" in page
    assert "innerHTML" not in page, "the people's text is set as text, never as markup"
