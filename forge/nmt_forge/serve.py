"""``nmt-forge serve <export>/model`` — a trained forge model behind the two
HTTP contracts the champollion CLI speaks. (The export directory itself, or
an export written before 2026-10-03, is accepted too: the model directory
is found from it.)

- ``POST /translate`` — the champollion **api-method** contract
  (``cli/lib/methods/api.js``): ``{source_locale, target_locale, method,
  keys: {key: source}}`` → ``{translations: {key: target}, meta}`` — exactly
  the keys asked for (unusable values come back under ``errors`` with a
  207). Pair it with ``"method": "api", "endpoint":
  "http://127.0.0.1:8378/translate"``. An optional ``"text_format":
  "markdown"`` marks the values as Markdown document text (what the CLI
  sends for a content file's body) rather than app strings.
- ``POST /v1/chat/completions`` — **OpenAI-compatible**, for ``champollion
  sync --method local`` (``LOCAL_API_BASE=http://127.0.0.1:8378/v1``). An
  NMT model cannot follow instructions, so the server reads the CLI's
  requests by their SHAPE and translates only the text in them (a response
  header says the instructions were ignored):
  a JSON object of strings (key-value sync) → the same keys back;
  the content block-batch prompt (``⟦SEG_N⟧`` segments) → every segment back
  under its own marker; the whole-page content prompt (instructions, then
  ``---``, then the Markdown body) → the translated body; any other message
  → translated as Markdown.
- ``GET /health``, ``GET /v1/models``.

Every string goes through :mod:`nmt_forge.textpipe` first: placeholders,
ICU plural/select skeletons, tags, inline code, URLs and Markdown structure
are copied verbatim and the model sees only the text between them, sentence
by sentence — a sentence-level model fed a whole Markdown page or an ICU
message garbles it.

Stdlib HTTP only (no web framework); one model load, decodes serialized
under a lock. Binds 127.0.0.1 by default; a non-loopback bind REQUIRES a
bearer token (``--token`` / ``$NMT_FORGE_SERVE_TOKEN``) — anyone who can
reach the port can use your model. Requests are size-capped. The decode
regime is the one the model was SELECTED under: if the run used a decode
hook (e.g. an FST tie-break) the server loads it, and refuses to start
without it unless ``--no-hook`` is passed explicitly (then /health and every
response say so).
"""

from __future__ import annotations

import errno
import hmac
import json
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import textpipe
from .errors import ForgeError

TOKEN_ENV = "NMT_FORGE_SERVE_TOKEN"
MAX_BODY_BYTES = 1_000_000
MAX_KEYS = 500
# a long value (a Markdown body, a big table block) is split into sentences
# before the model sees it, so the per-string cap bounds request size, not
# decode length; MAX_UNITS bounds the model work per request
MAX_CHARS_PER_STRING = 20_000
MAX_UNITS = 5_000
LOOPBACK = ("127.0.0.1", "::1", "localhost")
# ASCII on purpose: it also travels as an HTTP header (latin-1 only)
INSTRUCTIONS_NOTE = ("nmt-forge model: instructions/system prompts are not "
                     "followed - only the source text is translated")


def _locale_base(loc: str | None) -> str:
    return str(loc or "").replace("_", "-").split("-")[0].lower()


class ForgeModelServer:
    """The loaded export: decode(texts) → translations, plus its identity."""

    def __init__(self, export_dir: str | Path, *, device: str = "auto",
                 allow_no_hook: bool = False,
                 allow_locales: list[str] | tuple = ()):
        from .export import find_forge_model

        given = Path(export_dir)
        # the model directory (<export>/model), the export directory, or an
        # export written before 2026-10-03 (forge-model.json at its root)
        mf = find_forge_model(given)
        if mf is None:
            raise ForgeError(
                f"{given} is not an nmt-forge export (no forge-model.json)\n"
                "  fix: nmt-forge export <run-manifest> --out <dir>, then "
                "serve <dir>/model")
        self.dir = mf.parent
        self.manifest = json.loads(mf.read_text(encoding="utf-8"))
        if not self.manifest.get("model_dir"):
            raise ForgeError(
                f"{given} was exported with --no-model — there is no model "
                "to serve; re-export without --no-model")
        # relative to the forge-model.json: "." (the model directory itself)
        # since 2026-10-03, "model" in older exports
        model_dir = self.dir / self.manifest["model_dir"]
        from .training.backends import Checkpoint, HFSeq2SeqBackend

        params = {"backend": "hf-seq2seq", "base": str(model_dir),
                  "device": device,
                  **(self.manifest.get("model_params") or {})}
        self.backend = HFSeq2SeqBackend(params)
        self.checkpoint = Checkpoint(id="exported", step=0,
                                     path=str(model_dir))
        decode = self.manifest.get("decode") or {}
        self.decode_params = {"max_new_tokens": decode.get("max_new_tokens",
                                                           256)}
        self.hook_spec = decode.get("hook")
        self.hook_active = False
        if self.hook_spec:
            try:
                from importlib import import_module

                module, _, attr = self.hook_spec.partition(":")
                self.decode_params.update(
                    decode_hook=getattr(import_module(module), attr),
                    num_beams=decode.get("num_beams", 4))
                self.hook_active = True
            except Exception as e:
                if not allow_no_hook:
                    raise ForgeError(
                        f"the model was selected under decode hook "
                        f"{self.hook_spec!r}, which is not importable here "
                        f"({type(e).__name__}: {e})\n"
                        "  why: serving it without the hook deploys a "
                        "different decoding regime than the one measured\n"
                        "  fix: install the hook's package, or pass "
                        "--no-hook to serve the plain decode knowingly "
                        "(reported on /health and every response)") from e
        lang = self.manifest.get("language") or {}
        self.source_locales = {_locale_base(x) for x in
                               lang.get("source_locales") or [lang.get("source")]
                               if x}
        self.target_locales = {_locale_base(x) for x in
                               lang.get("target_locales") or [lang.get("target")]
                               if x}
        # --allow-locale SRC:TGT or a bare code (added to both sides) — for
        # a locale spelling the export could not resolve offline (en ⇄ eng)
        for loc in allow_locales or ():
            src, sep, tgt = str(loc).partition(":")
            if sep:
                self.source_locales.add(_locale_base(src))
                self.target_locales.add(_locale_base(tgt))
            else:
                self.source_locales.add(_locale_base(loc))
                self.target_locales.add(_locale_base(loc))
        self.name = self.manifest.get("name", "nmt-forge-model")
        self._lock = threading.Lock()
        # load once now, so the first request is not the slow one and a
        # broken export fails at startup, not mid-sync
        self.translate(["ok"])

    def translate(self, texts: list[str]) -> list[str]:
        if not texts:
            return []
        with self._lock:
            return self.backend.decode(self.checkpoint, list(texts),
                                       dict(self.decode_params))

    def health(self) -> dict:
        lang = self.manifest.get("language") or {}
        return {
            "status": "ok",
            "model": self.name,
            "pair": f"{lang.get('source')}→{lang.get('target')}",
            "accepts": {"source": sorted(self.source_locales),
                        "target": sorted(self.target_locales)},
            "decode_hook": (self.hook_spec if self.hook_active
                            else ("DISABLED (--no-hook): " + self.hook_spec
                                  if self.hook_spec else None)),
            "run": self.manifest.get("run"),
            "dev_report": self.manifest.get("dev_report"),
            "test_report": (self.manifest.get("test_report") or {}).get(
                "weighted"),
            # what the eval harness says qualifies that score, verbatim —
            # it travels with the number (Round 13); null when none
            "score_caveats": (self.manifest.get("test_report") or {}).get(
                "score_caveats"),
            "caveats": self.manifest.get("caveats"),
            "text_pipeline": textpipe.DESCRIPTION,
        }

    def check_locales(self, source: str | None, target: str | None
                      ) -> str | None:
        """An error message when the request asks for a pair this model
        does not translate; None when it is fine (or unspecified)."""
        if target and self.target_locales and \
                _locale_base(target) not in self.target_locales:
            return (f"this model translates into "
                    f"{sorted(self.target_locales)}; the request asked for "
                    f"target_locale={target!r} (if that IS this language "
                    f"under another code, restart serve with --allow-locale "
                    f"{target})")
        if source and self.source_locales and \
                _locale_base(source) not in self.source_locales:
            return (f"this model translates from "
                    f"{sorted(self.source_locales)}; the request asked for "
                    f"source_locale={source!r} (if that IS this language "
                    f"under another code, restart serve with --allow-locale "
                    f"{source})")
        return None


def _extract_json_object(text: str) -> dict | None:
    """The trailing JSON object of strings in a champollion user prompt
    (``JSON.stringify(keys, null, 2)`` after optional hint blocks)."""
    starts = [i for i, ch in enumerate(text)
              if ch == "{" and (i == 0 or text[i - 1] == "\n")]
    for i in starts:
        try:
            obj = json.loads(text[i:])
        except ValueError:
            continue
        if isinstance(obj, dict) and obj and all(
                isinstance(v, str) for v in obj.values()):
            return obj
    return None


# The champollion CLI's content prompts (cli/lib/segment.js
# buildBlockBatchPrompt / cli/lib/content.js buildContentPrompt), read by
# shape: a marker line per segment, or instructions + "---" + the body.
_SEG_MARKER = re.compile(r"^⟦SEG_(\d+)⟧[ \t]*$", re.M)
_PAGE_HEAD = "You are translating Markdown content"
_PAGE_SEPARATOR = "\n---\n"


def _block_batch(text: str) -> list[tuple[str, str]] | None:
    """``[(id, segment text), …]`` of a block-batch prompt, in order, or
    None. Everything before the first marker (instructions, coaching) is
    ignored; the blank line between segments is the prompt's, not the
    segment's (the CLI re-attaches separators from the source)."""
    marks = list(_SEG_MARKER.finditer(text))
    if not marks:
        return None
    out = []
    for k, m in enumerate(marks):
        end = marks[k + 1].start() if k + 1 < len(marks) else len(text)
        seg = text[m.end():end]
        seg = re.sub(r"^\r?\n", "", seg)
        seg = re.sub(r"[\r\n]+\s*$", "", seg)
        out.append((m.group(1), seg))
    return out


def _page_body(text: str) -> str | None:
    """The Markdown body of a whole-page content prompt, or None."""
    at = text.find(_PAGE_HEAD)
    if at < 0:
        return None
    sep = text.find(_PAGE_SEPARATOR, at)
    if sep < 0:
        return None
    return text[sep + len(_PAGE_SEPARATOR):]


def make_handler(model: ForgeModelServer, token: str | None):
    class Handler(BaseHTTPRequestHandler):
        server_version = "nmt-forge-serve"

        def log_message(self, fmt, *args):     # quiet; one line per request
            print(f"[serve] {self.address_string()} {fmt % args}", flush=True)

        # -- helpers ----------------------------------------------------------

        def _send(self, status: int, body: dict, headers: dict | None = None):
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            for k, v in (headers or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)

        def _error(self, status: int, message: str):
            self._send(status, {"error": {"message": message}})

        def _authorized(self) -> bool:
            if not token:
                return True
            got = self.headers.get("Authorization", "")
            ok = got.startswith("Bearer ") and hmac.compare_digest(
                got[7:].strip(), token)
            if not ok:
                self._error(401, "missing or wrong bearer token "
                                 "(Authorization: Bearer <token>)")
            return ok

        def _body(self) -> dict | None:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY_BYTES:
                self._error(413, f"request body over {MAX_BODY_BYTES} bytes")
                return None
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
            except ValueError:
                self._error(400, "request body is not valid JSON")
                return None
            if not isinstance(body, dict):
                self._error(400, "request body must be a JSON object")
                return None
            return body

        def _too_big(self, texts: list[str], *, max_strings: int | None
                     = MAX_KEYS) -> bool:
            if max_strings is not None and len(texts) > max_strings:
                self._error(413, f"{len(texts)} strings in one request — the "
                                 f"limit is {max_strings}")
                return True
            if any(len(t) > MAX_CHARS_PER_STRING for t in texts):
                self._error(413, f"a string is over {MAX_CHARS_PER_STRING} "
                                 "characters")
                return True
            return False

        def _run(self, texts: list[str], *, markdown: bool
                 ) -> list[str] | None:
            """Translate whole strings through the text pipeline; on a
            refusal or a model failure the error response is already sent
            and None is returned (never a partial answer)."""
            try:
                return textpipe.translate_texts(
                    texts, model.translate, markdown=markdown,
                    max_units=MAX_UNITS)
            except ValueError as e:          # over MAX_UNITS
                self._error(413, str(e))
            except Exception as e:           # the model itself failed
                self._error(500, f"the model failed to translate this "
                                 f"request ({type(e).__name__}: {e})")
            return None

        # -- routes -----------------------------------------------------------

        def do_GET(self):
            if self.path.rstrip("/") == "/health":
                return self._send(200, model.health())
            if not self._authorized():
                return None
            if self.path.rstrip("/") == "/v1/models":
                return self._send(200, {"object": "list", "data": [
                    {"id": model.name, "object": "model",
                     "owned_by": "nmt-forge"}]})
            return self._error(404, f"no route {self.path}")

        def do_POST(self):
            if not self._authorized():
                return None
            route = self.path.rstrip("/")
            if route == "/translate":
                return self._translate()
            if route == "/v1/chat/completions":
                return self._chat()
            return self._error(404, f"no route {self.path}")

        def _translate(self):
            body = self._body()
            if body is None:
                return None
            keys = body.get("keys")
            if not isinstance(keys, dict):
                return self._error(400, "'keys' must be an object of "
                                        "key → source string")
            problem = model.check_locales(body.get("source_locale"),
                                          body.get("target_locale"))
            if problem:
                return self._error(400, problem)
            good = {k: v for k, v in keys.items()
                    if isinstance(v, str) and v.strip()}
            errors = {k: {"message": "not a non-empty string"}
                      for k in keys if k not in good}
            if self._too_big(list(good.values())):
                return None
            names = list(good)
            outs = self._run([good[k] for k in names],
                             markdown=body.get("text_format") == "markdown")
            if outs is None:
                return None
            translations = dict(zip(names, outs))
            meta = {"model": model.name, "method": "nmt-forge",
                    "note": INSTRUCTIONS_NOTE}
            if model.hook_spec and not model.hook_active:
                meta["decode_hook"] = "DISABLED (--no-hook)"
            payload = {"translations": translations, "meta": meta}
            if errors:
                payload["errors"] = errors
                return self._send(207, payload)
            return self._send(200, payload)

        def _chat(self):
            body = self._body()
            if body is None:
                return None
            msgs = body.get("messages")
            if not isinstance(msgs, list) or not msgs:
                return self._error(400, "'messages' must be a non-empty list")
            user = next((m for m in reversed(msgs)
                         if isinstance(m, dict) and m.get("role") == "user"),
                        None)
            content = (user or {}).get("content")
            if isinstance(content, list):     # content parts
                content = "\n".join(p.get("text", "") for p in content
                                    if isinstance(p, dict))
            if not isinstance(content, str) or not content.strip():
                return self._error(400, "no user message text to translate")
            segments = _block_batch(content)
            page = None if segments is not None else _page_body(content)
            obj = (_extract_json_object(content)
                   if segments is None and page is None else None)
            if segments is not None:
                # content sync, block mode: every segment back under its
                # own marker, in order — never one more or one fewer
                texts = [t for _, t in segments]
                if self._too_big(texts, max_strings=None):
                    return None
                outs = self._run(texts, markdown=True)
                if outs is None:
                    return None
                reply = "\n\n".join(f"⟦SEG_{sid}⟧\n{out}" for (sid, _), out
                                     in zip(segments, outs))
            elif page is not None:
                # content sync, page mode: only the body after "---"
                if self._too_big([page], max_strings=None):
                    return None
                outs = self._run([page], markdown=True)
                if outs is None:
                    return None
                reply = outs[0]
            elif obj is not None:
                # key-value sync: the same keys back, values translated
                names = list(obj)
                if self._too_big([obj[k] for k in names]):
                    return None
                outs = self._run([obj[k] for k in names], markdown=False)
                if outs is None:
                    return None
                reply = json.dumps(dict(zip(names, outs)), ensure_ascii=False)
            else:
                if self._too_big([content], max_strings=None):
                    return None
                outs = self._run([content], markdown=True)
                if outs is None:
                    return None
                reply = outs[0]
            now = int(time.time())
            return self._send(200, {
                "id": f"chatcmpl-nmtforge-{now}",
                "object": "chat.completion",
                "created": now,
                "model": model.name,
                "choices": [{"index": 0, "finish_reason": "stop",
                             "message": {"role": "assistant",
                                         "content": reply}}],
                "usage": {"prompt_tokens": 0, "completion_tokens": 0,
                          "total_tokens": 0},
            }, headers={"X-NMT-Forge-Note": INSTRUCTIONS_NOTE})

    return Handler


class _NotReady(BaseHTTPRequestHandler):
    """Placeholder handler between binding the port and loading the model
    (``serve_forever`` has not started yet, so it never answers)."""


def _bind_error(e: OSError, host: str, port: int, export_dir) -> ForgeError:
    """What a failed bind means, in words (it used to surface as a bare
    "file error: [Errno 48] Address already in use")."""
    nxt = port + 1 if 0 < port < 65535 else 8379
    if e.errno == errno.EADDRINUSE:
        return ForgeError(
            f"port {port} on {host} is already in use — another program (or "
            "another `nmt-forge serve`) is listening there\n"
            f"  fix: pick another port: nmt-forge serve {export_dir} --port "
            f"{nxt} — then use that port in the champollion config "
            f"(\"endpoint\": \"http://127.0.0.1:{nxt}/translate\") or "
            f"LOCAL_API_BASE=http://127.0.0.1:{nxt}/v1; or stop what holds "
            f"port {port} (`lsof -i :{port}` shows it)")
    if e.errno == errno.EACCES:
        return ForgeError(
            f"not allowed to listen on port {port} ({e.strerror}) — ports "
            "below 1024 need administrator rights\n"
            f"  fix: nmt-forge serve {export_dir} --port 8378 (any port "
            "from 1024 up)")
    if e.errno == errno.EADDRNOTAVAIL:
        return ForgeError(
            f"cannot listen on {host}: no network interface on this machine "
            "has that address\n"
            f"  fix: --host 127.0.0.1 (this machine only), or --host 0.0.0.0 "
            "with a token (every interface)")
    return ForgeError(f"cannot listen on {host}:{port}: {e}")


def build_server(export_dir: str | Path, *, host: str = "127.0.0.1",
                 port: int = 8378, token: str | None = None,
                 device: str = "auto", allow_no_hook: bool = False,
                 allow_locales: list[str] | tuple = ()
                 ) -> tuple[ThreadingHTTPServer, ForgeModelServer]:
    token = token or os.environ.get(TOKEN_ENV) or None
    if host not in LOOPBACK and not token:
        raise ForgeError(
            f"refusing to bind {host} without a token\n"
            "  why: anyone who can reach the port could use your model (and "
            "read what it was trained to say)\n"
            f"  fix: set {TOKEN_ENV}=<long random string> (or --token), or "
            "keep the default 127.0.0.1")
    # bind BEFORE loading the model: a busy port is said in a second, not
    # after the model has loaded
    httpd = ThreadingHTTPServer((host, port), _NotReady,
                                bind_and_activate=False)
    try:
        httpd.server_bind()
        httpd.server_activate()
    except OSError as e:
        httpd.server_close()
        raise _bind_error(e, host, port, export_dir) from None
    try:
        model = ForgeModelServer(export_dir, device=device,
                                 allow_no_hook=allow_no_hook,
                                 allow_locales=allow_locales)
    except BaseException:
        httpd.server_close()
        raise
    httpd.RequestHandlerClass = make_handler(model, token)
    return httpd, model
