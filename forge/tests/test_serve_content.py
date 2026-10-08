"""`nmt-forge serve` × the champollion CLI's real requests (synthetic users,
2026-10): a trained model deployed through both CLI routes translated app
strings but failed every Markdown body ("block-batch translation returned no
results" via `api`, "5 of 5 block(s) missing … [EN]" via `local`), and lost
{menu}/{name}/ICU plurals so the CLI's gate refused those keys.

The server tests use a stand-in model (no torch). The last test drives the
REAL CLI — `champollion sync` with the `api` method, the `local` method and
page-mode content — against the server, when node and the CLI checkout are
present (the monorepo); a standalone forge install skips it."""

import json
import os
import re
import shutil
import subprocess
import threading
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from nmt_forge import serve as serve_mod


# what a model trained on plain sentences does to markup it never saw:
# drops it (the real exported model replaced "⟦SEG_0⟧" and "{menu}" with
# whole memorized sentences) — a stand-in that COPIES its input would hide
# exactly the failures these tests exist for
_MARKUP = re.compile(r"[⟦⟧{}#%<>*\[\]`|~]")


class FakeModel:
    name = "fake-model"
    hook_spec = None
    hook_active = False

    def __init__(self, fail=False):
        self.seen: list[str] = []
        self.fail = fail

    def translate(self, texts):
        if self.fail:
            raise RuntimeError("CUDA out of memory")
        self.seen.extend(texts)
        return [f"T({_MARKUP.sub('', t)})" for t in texts]

    def check_locales(self, source, target):
        return None

    def health(self):
        return {"status": "ok", "model": self.name}


@pytest.fixture
def server():
    from http.server import ThreadingHTTPServer

    started = []

    def start(model=None):
        model = model or FakeModel()
        httpd = ThreadingHTTPServer(("127.0.0.1", 0),
                                    serve_mod.make_handler(model, None))
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        started.append(httpd)
        return f"http://127.0.0.1:{httpd.server_address[1]}", model

    yield start
    for h in started:
        h.shutdown()


def _post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def _chat(base, content, system="Translate. Keep the markers."):
    status, body = _post(f"{base}/v1/chat/completions", {
        "model": "x", "messages": [{"role": "system", "content": system},
                                   {"role": "user", "content": content}]})
    assert status == 200, body
    return body["choices"][0]["message"]["content"]


APP = {
    "Home.title": "Welcome, families",
    "Home.lunch": "Lunch today: {menu}",
    "Home.events": "{count, plural, one {# event this week} "
                   "other {# events this week}}",
    "Forms.thanks": "Thank you, {name}!",
    "Nav.home": "Home",
}


# -- /translate (api method) --------------------------------------------------------

def test_translate_protects_placeholders_and_returns_exactly_the_keys(server):
    base, model = server()
    status, body = _post(f"{base}/translate", {
        "source_locale": "en", "target_locale": "crk", "keys": APP})
    assert status == 200
    tr = body["translations"]
    assert set(tr) == set(APP)
    assert tr["Home.lunch"] == "T(Lunch today:) {menu}"
    assert tr["Forms.thanks"] == "T(Thank you,) {name}!"
    assert tr["Home.events"] == ("{count, plural, one {# T(event this week)} "
                                 "other {# T(events this week)}}")
    assert not any("{" in t or "#" in t for t in model.seen)


def test_translate_markdown_values_keep_structure(server):
    base, model = server()
    block = "The bus driver brings\nthe photos **today** ⟦PROTECTED_0⟧."
    status, body = _post(f"{base}/translate", {
        "source_locale": "en", "target_locale": "crk",
        "text_format": "markdown",
        "keys": {"segment.0": block, "segment.1": "- one\n- two"}})
    assert status == 200
    assert body["translations"] == {
        "segment.0": "T(The bus driver brings the photos) **T(today)** "
                     "⟦PROTECTED_0⟧.",
        "segment.1": "- T(one)\n- T(two)"}


def test_translate_refuses_instead_of_answering_partially(server):
    base, _ = server(FakeModel(fail=True))
    status, body = _post(f"{base}/translate", {"keys": {"a": "Hello"}})
    assert status == 500 and "CUDA out of memory" in body["error"]["message"]
    base, _ = server()
    per_key = serve_mod.MAX_UNITS // 400 + 1          # 400 keys < MAX_KEYS
    keys = {f"k{k}": " ".join(f"Key {k} sentence {i}." for i in range(per_key))
            for k in range(400)}
    status, body = _post(f"{base}/translate", {"keys": keys})
    assert status == 413 and "limit" in body["error"]["message"]


# -- /v1/chat/completions (local method): the CLI's content prompts ---------------

BLOCK_PROMPT = """IMPORTANT — Follow these grammar rules:
  • a coaching block the CLI may prepend

You are translating Markdown content from English to Plains Cree. The document was split into 3 numbered segment(s); segments not shown are already translated.

Register/tone: neutral

Rules:
- Echo each ⟦SEG_N⟧ marker on its own line, EXACTLY as given, before its translated segment.
- Return ONLY the markers and the translated segments.

⟦SEG_0⟧
# October at our school

⟦SEG_1⟧
The elders visit the class tomorrow. Please bring the forms.

⟦SEG_2⟧
- The students read ⟦PROTECTED_0⟧.
- Our teacher [sings](https://x.example/songs)."""


def test_chat_answers_the_block_batch_prompt_segment_for_segment(server):
    base, model = server()
    reply = _chat(base, BLOCK_PROMPT)
    assert reply == (
        "⟦SEG_0⟧\n# T(October at our school)\n\n"
        "⟦SEG_1⟧\nT(The elders visit the class tomorrow.) "
        "T(Please bring the forms.)\n\n"
        "⟦SEG_2⟧\n- T(The students read) ⟦PROTECTED_0⟧.\n"
        "- T(Our teacher) [T(sings)](https://x.example/songs).")
    # the instructions never reach the model
    assert not any("Rules" in t or "SEG" in t or "grammar" in t
                   for t in model.seen)


def test_chat_answers_the_page_prompt_with_the_body_only(server):
    base, model = server()
    prompt = ("You are translating Markdown content from English to Plains "
              "Cree.\n\nRules:\n- Return ONLY the translated Markdown.\n\n"
              "---\n# Title\n\nFirst paragraph.\n\n---\n\nAfter a rule.\n")
    reply = _chat(base, prompt)
    assert reply == ("# T(Title)\n\nT(First paragraph.)\n\n---\n\n"
                     "T(After a rule.)\n")
    assert "Rules" not in " ".join(model.seen)


def test_chat_key_value_json_keeps_keys_and_placeholders(server):
    base, _ = server()
    reply = json.loads(_chat(base, "UI context:\n- button\n\n"
                             + json.dumps(APP, indent=2)))
    assert set(reply) == set(APP)
    assert reply["Home.lunch"] == "T(Lunch today:) {menu}"


# -- the REAL champollion CLI against serve -----------------------------------------

CLI = Path(__file__).resolve().parents[2] / "cli"
_NODE = shutil.which("node")
_CLI_READY = (CLI / "bin" / "cli.js").is_file() and (
    CLI / "node_modules").is_dir()

NEWSLETTER = """---
title: October newsletter
description: News from our school
---

# October at our school

The elders visit the class tomorrow. Please bring the forms.

Please read the **forms** and visit [our page](https://school.example/forms).
The bus driver brings the photos
at the feast.

- The students read the stories.
- The elders visit the class.

```sh
echo "do not translate"
```
"""

EN_JSON = {
    "Home": {"title": "Welcome, families", "lunch": "Lunch today: {menu}",
             "events": "{count, plural, one {# event this week} "
                       "other {# events this week}}"},
    "Forms": {"submit": "Send the form", "thanks": "Thank you, {name}!"},
    "Nav": {"home": "Home", "calendar": "Calendar",
            "contact": "Contact the school"},
}


def _project(root: Path, base: str, **config) -> Path:
    (root / "app" / "messages").mkdir(parents=True)
    (root / "newsletter").mkdir()
    (root / "home").mkdir()
    (root / "app" / "messages" / "en.json").write_text(json.dumps(EN_JSON))
    (root / "newsletter" / "2026-10.md").write_text(NEWSLETTER)
    (root / "champollion.config.json").write_text(json.dumps({
        "version": 3, "inputLocale": "en", "localesDir": "./app/messages",
        "contentDir": "./newsletter", "languages": ["crk"], "format": "auto",
        "pairs": {"en:crk": {"method": "api", "script": "Latn",
                             "endpoint": f"{base}/translate"}},
        **config}))
    return root


def _sync(root: Path, base: str, *extra) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items()
           if not k.endswith("_API_KEY") and not k.endswith("_API_BASE")}
    env.update(HOME=str(root / "home"), CHAMPOLLION_API_KEY="test",
               LOCAL_API_BASE=f"{base}/v1", NO_COLOR="1")
    return subprocess.run([_NODE, str(CLI / "bin" / "cli.js"), "sync",
                           *extra], cwd=root, env=env, capture_output=True,
                          text=True, timeout=180)


@pytest.mark.skipif(not (_NODE and _CLI_READY),
                    reason="needs node and the champollion CLI checkout "
                           "(cli/ with node_modules) next to forge/")
@pytest.mark.parametrize("route, extra, config", [
    ("api", (), {}),
    ("local", ("--method", "local"), {}),
    ("api-page", (), {"contentSegmentation": "page"}),
    ("local-page", ("--method", "local"), {"contentSegmentation": "page"}),
])
def test_the_real_cli_deploys_app_strings_and_the_newsletter(
        tmp_path, server, route, extra, config):
    base, _ = server()
    root = _project(tmp_path / route, base, **config)
    res = _sync(root, base, *extra)
    log = res.stdout + res.stderr
    assert res.returncode == 0, log[-3000:]

    body = (root / "newsletter" / "2026-10.crk.md").read_text()
    assert "[EN]" not in body, body
    assert "# T(October at our school)" in body
    assert "**T(forms)**" in body
    assert "[T(our page)](https://school.example/forms)" in body
    assert "T(The bus driver brings the photos at the feast.)" in body
    assert "- T(The students read the stories.)" in body
    assert '```sh\necho "do not translate"\n```' in body
    assert "title: T(October newsletter)" in body or \
        'title: "T(October newsletter)"' in body

    app = json.loads((root / "app" / "messages" / "crk.json").read_text())
    assert app["Home"]["lunch"] == "T(Lunch today:) {menu}"
    assert app["Forms"]["thanks"] == "T(Thank you,) {name}!"
    assert app["Home"]["events"] == (
        "{count, plural, one {# T(event this week)} "
        "other {# T(events this week)}}")
    assert re.search(r"failed (translation|quality)", log) is None, log
