"""``nmt-forge serve <export>/model`` — a trained forge model behind the two
HTTP contracts the champollion CLI speaks. (The export directory itself, or
an export written before 2026-10-03, is accepted too: the model directory
is found from it.)

- ``POST /translate`` — **service-api/1**, the one /translate contract
  (``shared/schemas/framework/service-api.v1.schema.json``; held to its
  vectors in ``tests/test_service_api_contract.py``; the client is
  ``cli/lib/methods/api.js``): ``{source_locale, target_locale, method,
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
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import textpipe
from .errors import ForgeError
from .privacy import output_local_only
from .seen_words import UNSEEN_NOTE
from .training.decode_cap import cap_params

#: Said when an export carries no record of the words its model saw.
UNSEEN_UNAVAILABLE = ("no record of the words this model saw in training sits beside its folder (an "
                      "export made before 2026-10-13, one made without its training files on the "
                      "computer, or a model folder copied away from its export): a sentence holding a "
                      "word it never saw cannot be named — serve it from its export, or export it again")

TOKEN_ENV = "NMT_FORGE_SERVE_TOKEN"
MAX_BODY_BYTES = 1_000_000
MAX_KEYS = 500
# a long value (a Markdown body, a big table block) is split into sentences
# before the model sees it, so the per-string cap bounds request size, not
# decode length; MAX_UNITS bounds the model work per request
MAX_CHARS_PER_STRING = 20_000
MAX_UNITS = 5_000
# the model is asked CHUNK pieces at a time, the lock taken per chunk: one
# sentence from another request waits for a chunk, not for a 5,000-piece
# request (FORGE_MACHINE_CRITIQUE finding 12); a request that takes longer
# than REQUEST_SECONDS is refused whole, never answered in part
CHUNK = 32
REQUEST_SECONDS = 600
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
        self.decode_params = cap_params(decode)          # fixed or proportional, as exported
        # decode as the model was measured: beams only where its export says
        # they were applied (exports before 2026-10-13 were measured greedily)
        if decode.get("beams_applied") and int(decode.get("num_beams") or 1) > 1:
            self.decode_params["num_beams"] = int(decode["num_beams"])
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
        # what it writes is held to what it learned from (unrecorded →
        # local-only): reported on /health and on every /translate
        self.output_local_only = output_local_only(
            self.manifest.get("trained_on"))
        # who agreed it may be served off this machine (build_server)
        self.holders_agreed_by: str | None = None
        # the words its training sources held, at the export's root beside
        # model/: each reply names the words of a sentence the model never saw
        # (stress test 4); None for an export made before 2026-10-13 or a
        # model folder copied away from its export — said on /health and
        # every reply
        from .seen_words import SeenWords

        self.seen_words = SeenWords.load(model_dir.parent)
        self._lock = threading.Lock()
        # load once now, so the first request is not the slow one and a
        # broken export fails at startup, not mid-sync
        self.translate(["ok"])

    @property
    def _cuts(self):
        """Per request thread: the length cuts counted so far."""
        if "_cuts_local" not in self.__dict__:
            self.__dict__["_cuts_local"] = threading.local()
        return self.__dict__["_cuts_local"]

    def start_request(self) -> None:
        """Begin counting this thread's request's length cuts."""
        self._cuts.inputs = self._cuts.outputs = 0

    def request_cut(self) -> dict:
        """Sentences (or segments) of this thread's request cut going in, and
        translations that stopped at the length cap."""
        return {"inputs": getattr(self._cuts, "inputs", 0), "outputs": getattr(self._cuts, "outputs", 0)}

    def translate(self, texts: list[str]) -> list[str]:
        if not texts:
            return []
        out: list[str] = []
        t0 = time.monotonic()
        for i in range(0, len(texts), CHUNK):
            if time.monotonic() - t0 > REQUEST_SECONDS:
                raise TimeoutError(
                    f"the request took longer than {REQUEST_SECONDS} s ({i} of {len(texts)} pieces done) "
                    "— send fewer pieces at a time")
            with self._lock:
                part = self.backend.decode(self.checkpoint, list(texts[i:i + CHUNK]),
                                           dict(self.decode_params))
                last = getattr(self.backend, "last_decode", None) or {}
            self._cuts.inputs = getattr(self._cuts, "inputs", 0) + len(last.get("inputs_cut") or [])
            self._cuts.outputs = getattr(self._cuts, "outputs", 0) + len(last.get("outputs_at_cap") or [])
            out.extend(part)
        return out

    def health(self) -> dict:
        lang = self.manifest.get("language") or {}
        return {
            "status": "ok",
            "model": self.name,
            # which process answers: a background job counts as started only
            # when its OWN server answers (2026-10-12: an old server on the
            # same port answered for a new one that had failed to bind)
            "pid": os.getpid(),
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
            # the terms of what the model learned from, and what follows
            # for what it writes (privacy.output_local_only: unrecorded
            # counts as local-only)
            "trained_on": self.manifest.get("trained_on"),
            "output_local_only": self.output_local_only,
            # who agreed that local-only output may leave this machine (an
            # off-loopback serve is refused without it); None otherwise
            "holders_agreed_by": getattr(self, "holders_agreed_by", None),
            # where it runs when that is not the usual (a training job on the GPU)
            "device_note": getattr(self, "device_note", None),
            # the bounds a request meets: pieces per request, pieces per turn
            # at the model, and the time after which it is refused whole
            "limits": {"pieces_per_request": MAX_UNITS, "pieces_per_turn": CHUNK,
                       "request_seconds": REQUEST_SECONDS},
            # whether each reply names the words of a sentence the model
            # never saw in training (and why not, when it cannot)
            "unseen_words_check": (
                {"on": True, "words_seen": len(self.seen_words.words), "notes": self.seen_words.notes or None}
                if getattr(self, "seen_words", None) is not None
                else {"on": False, "why": UNSEEN_UNAVAILABLE}),
            "text_pipeline": textpipe.DESCRIPTION,
            # Said out loud (2026-10-09): nothing here filters output. The
            # champollion CLI gates what `sync` writes; a direct /translate
            # caller gets the decode as-is.
            "output_gates": ("none — this server checks nothing it returns "
                             "(no empty/echo/script/repetition checks). "
                             "`champollion sync` gates every value before "
                             "writing it; a direct /translate caller gets the "
                             "model's output as decoded"),
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
            except TimeoutError as e:        # over REQUEST_SECONDS: no partial answer
                self._error(503, str(e))
            except Exception as e:           # the model itself failed
                self._error(500, f"the model failed to translate this "
                                 f"request ({type(e).__name__}: {e})")
            return None

        # -- routes -----------------------------------------------------------

        def do_GET(self):
            if self.path.rstrip("/") == "/health":
                return self._send(200, model.health())
            if self.path in ("", "/"):
                # a page to TRY the model (the person, not an app): the same
                # /translate contract, no external assets. It holds nothing
                # secret; with a token set, the page asks for it.
                data = _try_page(model.health(), token_required=bool(token)).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return None
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
            # NFC, as training data is (champollion data add): a decomposed
            # ê is different bytes to a byte model (plan A9)
            good = {k: unicodedata.normalize("NFC", v) for k, v in keys.items()
                    if isinstance(v, str) and v.strip()}
            errors = {k: {"message": "not a non-empty string"}
                      for k in keys if k not in good}
            if self._too_big(list(good.values())):
                return None
            names = list(good)
            if hasattr(model, "start_request"):
                model.start_request()
            outs = self._run([good[k] for k in names],
                             markdown=body.get("text_format") == "markdown")
            if outs is None:
                return None
            translations = dict(zip(names, outs))
            meta = {"model": model.name, "method": "nmt-forge",
                    "note": INSTRUCTIONS_NOTE}
            # what the model's length limits cut in this request, never
            # silently: sentences cut going in, translations stopped at the cap
            cut = model.request_cut() if hasattr(model, "request_cut") else {}
            if cut.get("inputs") or cut.get("outputs"):
                meta["cut"] = cut
            if getattr(model, "output_local_only", False):
                # the caller decides where the text goes; it is told
                meta["output_local_only"] = True
            if model.hook_spec and not model.hook_active:
                meta["decode_hook"] = "DISABLED (--no-hook)"
            meta.update(_unseen_meta(model, {k: good[k] for k in names}))
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
            # what each part of the reply was translated from, by the name
            # the caller knows it by: for the words the model never saw
            asked = ({f"SEG_{sid}": t for sid, t in segments} if segments is not None
                     else {"page": page} if page is not None
                     else {k: str(v) for k, v in obj.items()} if obj is not None
                     else {"text": content})
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
                # what /translate says, said here too: a model that learned
                # from local-only sentences can repeat them (the CLI's local
                # method writes nothing then without the holders' agreement)
                "meta": {"output_local_only": bool(getattr(model, "output_local_only", False)),
                         **_unseen_meta(model, asked)},
            }, headers={"X-NMT-Forge-Note": INSTRUCTIONS_NOTE})

    return Handler


def _unseen_meta(model, asked: dict[str, str]) -> dict:
    """A reply's fields naming, per key, the words of its text the model never
    saw in training (seen_words; stress test 4) — or saying the export cannot
    check. Nothing when there is nothing to name."""
    seen = getattr(model, "seen_words", None)
    if seen is not None:
        unseen = {k: u for k, t in asked.items() if (u := seen.unseen(t))}
        return {"unseen_words": unseen, "unseen_note": UNSEEN_NOTE} if unseen else {}
    if hasattr(model, "seen_words"):
        return {"unseen_check": UNSEEN_UNAVAILABLE}
    return {}


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


def _try_page(health: dict, *, token_required: bool) -> str:
    """GET / — a small page to try the model by hand. Plain HTML + a few
    lines of JS against the same-origin /translate; no external assets."""
    from html import escape

    pair = escape(str(health.get("pair") or ""))
    name = escape(str(health.get("model") or ""))
    report = health.get("test_report")
    score = ""
    if isinstance(report, dict) and report.get("score") is not None:
        score = (f"<p>Measured on your test sentences: chrF++ "
                 f"{escape(str(report.get('score')))}</p>")
    token_field = ('<label>Access token <input id="tok" type="password" '
                   'autocomplete="off"></label>' if token_required else "")
    local_note = (
        "<p class=\"note\"><b>What it writes stays here.</b> It learned from "
        "sentences marked local-only, and a small model repeats what it "
        "learned — keep its translations off outside AI services and online "
        "tools.</p>" if health.get("output_local_only") else "")
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Try {name}</title>
<style>
 body{{font:17px/1.5 system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;color:#1b1f23;background:#fbfaf8}}
 textarea{{width:100%;min-height:6rem;font:inherit;padding:.5rem}}
 button{{font:inherit;padding:.4rem 1rem;margin:.5rem 0}}
 #out{{white-space:pre-wrap;border-left:3px solid #0F766E;padding:.5rem 1rem;min-height:2rem;background:#fff}}
 .note{{font-size:.9rem;color:#555}}
 .warn{{font-size:.9rem;color:#C9444F;margin:0 0 .5rem}}
 @media (prefers-color-scheme:dark){{body{{background:#101312;color:#eef1ef}}#out{{background:#181c1a;border-color:#3FC1C0}}.note{{color:#aeb8b3}}.warn{{color:#F08A93}}}}
</style></head><body>
<h1>Try the model</h1>
<p><b>{name}</b> · {pair}</p>{score}
<label for="src">Text to translate (one sentence per line)</label>
<textarea id="src"></textarea>
{token_field}
<button id="go">Translate</button>
<div id="out" aria-live="polite"></div>
<p class="note">This model runs on this computer; nothing is sent elsewhere.
It checks nothing it returns — a fluent speaker decides what is fit to use.</p>
{local_note}
<script>
document.getElementById('go').onclick = async () => {{
  const out = document.getElementById('out');
  const lines = document.getElementById('src').value.split('\\n').filter(l => l.trim());
  const keys = Object.fromEntries(lines.map((l, i) => ['l' + i, l]));
  const headers = {{'content-type': 'application/json'}};
  const t = document.getElementById('tok');
  if (t && t.value) headers.authorization = 'Bearer ' + t.value;
  out.textContent = '…';
  try {{
    const r = await fetch('/translate', {{method: 'POST', headers, body: JSON.stringify({{keys}})}});
    const d = await r.json();
    if (!d.translations) {{ out.textContent = (d.error && d.error.message) || 'no answer'; return; }}
    // each line, and under it the words the model never saw in training
    const unseen = (d.meta && d.meta.unseen_words) || {{}};
    out.textContent = '';
    lines.forEach((l, i) => {{
      const p = document.createElement('div');
      p.textContent = d.translations['l' + i] ?? '(no translation)';
      out.appendChild(p);
      if (unseen['l' + i]) {{
        const w = document.createElement('div');
        w.className = 'warn';
        w.textContent = 'Never seen in training: ' + unseen['l' + i].join(', ')
          + ' — this line is very likely wrong, however fluent it reads.';
        out.appendChild(w);
      }}
    }});
    if (d.meta && d.meta.unseen_check) {{
      const n = document.createElement('p');
      n.className = 'note';
      n.textContent = d.meta.unseen_check;
      out.appendChild(n);
    }}
  }} catch (e) {{ out.textContent = 'could not reach the model: ' + e; }}
}};
</script></body></html>"""


def _training_running(export_dir: str | Path) -> bool:
    """Is a training job of the project this export sits in running now?"""
    from . import jobs
    from .workspace import Workspace

    for d in [Path(export_dir).resolve(), *Path(export_dir).resolve().parents]:
        if (d / ".forge").is_dir():
            try:
                return any(j.get("kind") == "train" and j.get("state") == "running"
                           for j in jobs.list_jobs(Workspace(d / ".forge")))
            except Exception:
                return False
    return False


def build_server(export_dir: str | Path, *, host: str = "127.0.0.1",
                 port: int = 8378, token: str | None = None,
                 device: str = "auto", allow_no_hook: bool = False,
                 allow_locales: list[str] | tuple = (),
                 holders_agreed_by: str | None = None
                 ) -> tuple[ThreadingHTTPServer, ForgeModelServer]:
    token = token or os.environ.get(TOKEN_ENV) or None
    if host not in LOOPBACK and not token:
        raise ForgeError(
            f"refusing to bind {host} without a token\n"
            "  why: anyone who can reach the port could use your model (and "
            "read what it was trained to say)\n"
            f"  fix: set {TOKEN_ENV}=<long random string> (or --token), or "
            "keep the default 127.0.0.1")
    # an address other machines reach sends what it writes off this one: a
    # model that learned from local-only sentences (or whose training terms
    # were never recorded) goes there only as the data's holders agreed —
    # read from forge-model.json before anything binds or loads
    agreed = None
    if host not in LOOPBACK:
        from .export import find_forge_model

        mf = find_forge_model(Path(export_dir))
        if mf is not None:
            try:
                trained_on = json.loads(mf.read_text(encoding="utf-8")).get("trained_on")
            except (OSError, ValueError, AttributeError):
                trained_on = None
            if output_local_only(trained_on):
                agreed = (holders_agreed_by or "").strip()
                if not agreed:
                    raise ForgeError(
                        f"refusing to serve on {host}: this model's output is local-only "
                        "(it learned from sentences marked local-only, or what it learned "
                        "from was never recorded)\n"
                        "  why: a small model repeats what it learned, and an address other "
                        "machines can reach sends what it writes off this one\n"
                        "  fix: only the data's holders can agree to that — ask them; if they "
                        "do, --holders-agreed-by \"<who agreed>\" (reported on /health). Or "
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
    # a training job on this project uses the GPU: the server takes the CPU
    # rather than share it (a shared GPU slows both and can run out of memory)
    device_note = None
    if device == "auto" and _training_running(export_dir):
        device, device_note = "cpu", "cpu — a training job of this project is using the GPU"
    try:
        model = ForgeModelServer(export_dir, device=device,
                                 allow_no_hook=allow_no_hook,
                                 allow_locales=allow_locales)
        model.device_note = device_note
    except BaseException:
        httpd.server_close()
        raise
    model.holders_agreed_by = agreed or None
    httpd.RequestHandlerClass = make_handler(model, token)
    return httpd, model
