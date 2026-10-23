"""``mt-eval serve`` — a method behind the champollion ``/translate`` contract.

Deployment as a service: the run pipeline's method, kept loaded, translating
what callers send — no references, nothing scored (``mt-eval translate`` is
the same for a file). The contract is service-api/1
(``framework/service_api.py``, held to the shared vectors; the client is the
champollion CLI's ``api`` method): ``POST /translate {source_locale,
target_locale, keys: {key: source}}`` → ``{translations: {key: target},
meta}``; ``207`` with ``errors`` for keys that failed. ``GET /health`` says
what is served and what it does not do.

Only a method that runs IN THIS PROCESS is served — a registered engine with
``in_process_transport`` (``lexicon``, ``local-model``) or a plugin that
declares dependency class S or O (no API of its own). A caller treats a
loopback endpoint as "the text stays on this machine"; a server wrapping a
method that forwards text to a hosted service would break that silently, so
it is refused, never served with a warning.

Stdlib HTTP; one method instance, translations serialized under a lock;
binds 127.0.0.1 by default, and a non-loopback bind needs a bearer token
(``$MT_EVAL_SERVE_TOKEN`` — never a command-line value). Requests are
size-capped. Nothing here checks what it returns (no output gates yet).

What it writes can carry what it read: a dictionary marked local-only, or a
model trained here on local-only sentences. ``/health`` and every
``/translate`` answer say so (``output_local_only``), and ``champollion
connect`` / ``sync`` hold such output out of an app's locale files until the
data's holders agree — the rule ``nmt-forge serve`` already follows.
``mt-eval translate`` keeps it for a file: marked local-only, and written
outside the project only with the holders' agreement (the note above
:func:`planned_identity`).
"""

from __future__ import annotations

import asyncio
import hmac
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from mt_eval_harness.config import RunConfig

TOKEN_ENV = "MT_EVAL_SERVE_TOKEN"
LOOPBACK = ("127.0.0.1", "::1", "localhost")
DEFAULT_PORT = 8379
MAX_BODY_BYTES = 1_000_000
MAX_KEYS = 500
MAX_CHARS_PER_STRING = 20_000
OUTPUT_GATES = ("none — this server checks nothing it returns (no empty/echo/"
                "script/repetition checks); `champollion sync` gates every "
                "value before writing it, a direct caller must check it")
NO_SERVICE = ("only a method that runs in this process is served: a caller "
              "treats a loopback endpoint as 'the text stays on this "
              "machine', and a server wrapping a method that sends text to a "
              "hosted service would break that")


#: Where this server's source is (AGPL-3.0 §13: offered to its network users).
SOURCE_URL = "https://github.com/gamedaysuits/Champollion"


def _harness_version() -> str:
    try:
        from mt_eval_harness import __version__
        return str(__version__)
    except Exception:
        return "unknown"


def _run_async(make_coro):
    """Run the coroutine ``make_coro()`` makes, to the end, from sync code —
    also when the caller is itself inside an event loop (a run scores in
    the runner's loop, and a gate's fallback translates there), where
    ``asyncio.run`` refuses: then on a thread with its own loop."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(make_coro())
    box: dict = {}

    def worker():
        try:
            box["value"] = asyncio.run(make_coro())
        except BaseException as exc:          # re-raised in the caller's thread
            box["error"] = exc

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join()
    if "error" in box:
        raise box["error"]
    return box.get("value")


class ServeError(RuntimeError):
    """A method this server will not serve, or a bind it refuses."""


#: The record ``nmt-forge export`` writes in the model folder — or, in an
#: export written before 2026-10-03 (``nmt-forge-model/1``), at the export's
#: root, beside the weights' ``model/``.
FORGE_MODEL = "forge-model.json"
_UNREADABLE = object()


def _forge_record(model_dir: Path) -> tuple[Path, object] | None:
    """The forge-model.json that records the model folder ``model_dir``,
    with its document (``_UNREADABLE`` when it cannot be read), or None.

    The folder's own record (whatever its ``model_dir`` says, as before);
    else its parent's when that record's ``model_dir`` resolves to this
    folder — ``-m export/model`` on an export written before 2026-10-03,
    whose record is the export's, one folder up. ``local_model.model_record``
    looks in the same two places to decode the model. A parent record that
    cannot be read may be this folder's, so it is returned (``model_record``
    refuses to decode beside it too)."""
    own = model_dir / FORGE_MODEL
    if own.is_file():
        return own, _read_record(own)
    parent = model_dir.parent / FORGE_MODEL
    if not parent.is_file():
        return None
    doc = _read_record(parent)
    if doc is _UNREADABLE:
        return parent, doc
    md = doc.get("model_dir") if isinstance(doc, dict) else None
    if not isinstance(md, str) or (parent.parent / md).resolve() != model_dir.resolve():
        return None                          # the record of another folder
    return parent, doc


def _read_record(f: Path):
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return _UNREADABLE


def output_local_only(identity: dict | None) -> tuple[bool | None, str]:
    """Whether what the method writes must stay on this machine, and why.

    True when a file it reads is marked local-only — a ``lexicon``
    dictionary's sidecar (an unreadable mark is a mark), or a model folder
    nmt-forge trained here whose training terms say local-only or were never
    recorded (forge's own rule, ``nmt_forge.privacy.output_local_only``; its
    forge-model.json found as :func:`_forge_record` finds it — an unreadable
    one is a mark too). False for a published (hub) model or an unmarked
    dictionary. None when nothing here records what the method learned from
    (a plugin, a model folder nmt-forge did not make): not known, said as
    such.
    """
    from mt_eval_harness.corpus_loader import LOCAL_ONLY, marked_local_only

    kind = (identity or {}).get("kind")
    path = (identity or {}).get("path")
    if kind == "file" and path:
        try:
            if marked_local_only(path):
                return True, "the dictionary it looks words up in is marked local-only"
        except ValueError:
            return True, "the dictionary's sidecar cannot be read (an unreadable mark is a mark)"
        return False, "the dictionary it looks words up in is not marked local-only"
    if kind == "directory" and path:
        found = _forge_record(Path(path))
        if found is None:
            return None, ("what this model learned from is not recorded here (no "
                          "forge-model.json) — not known")
        record, doc = found
        # one folder up, the record is not where a reader would look: say so
        # (not its path — /health sends this reason to whoever asks)
        here = record.parent == Path(path)
        if doc is _UNREADABLE:
            which = "its forge-model.json" if here else "the forge-model.json one folder up"
            return True, f"{which} cannot be read (an unreadable record is a mark)"
        where = "" if here else " — its record is the export's forge-model.json, one folder up"
        trained_on = doc.get("trained_on") if isinstance(doc, dict) else None
        terms = trained_on.get("terms") if isinstance(trained_on, dict) else None
        if not isinstance(terms, dict):
            return True, f"a model trained here whose training terms were never recorded{where}"
        if terms.get("transmission") == LOCAL_ONLY:
            return True, f"it learned from sentences marked local-only{where}"
        return False, f"it learned from no sentences marked local-only{where}"
    if kind == "hub":
        return False, "a published model — nothing it learned from is marked here"
    return None, "the method does not say what it reads — not known"


# -- the same rule for a file: ``mt-eval translate`` ------------------------------
#
# A server on a loopback address keeps local-only output on this machine; an
# address other machines reach needs --holders-agreed-by. For a file the line
# the tool can check is the PROJECT: the folder holding champollion.project.json
# at or above where the command runs (outside a rails project, the folder it
# runs in). Inside it — where the rails keep the holders' data and every tool
# reads the file's local-only mark — nobody's agreement is asked, as on
# loopback. Anywhere else (a synced folder, a shared drive, a website's folder)
# is a place the holders did not choose: writing there needs
# --holders-agreed-by "<who agreed>", recorded in the file's sidecar
# (holders_agreed). The agreement loosens nothing: the file stays marked
# local-only for every tool. It is a line the tool checks, not a wall — a file
# on this machine can be copied anywhere afterwards, and its mark goes with a
# copy only if the sidecar does.


def planned_identity(method: str, model: str) -> dict | None:
    """What a registered engine's ``-m`` names, decided from the name alone
    — its kind and path, nothing hashed or loaded — so that
    :func:`output_local_only` can be asked before a run (``mt-eval
    translate`` refuses a destination before translating anything). The
    engine's own ``resolve_identity`` decides the kind the same way: a file
    is a dictionary, a folder a model folder, any other name a published
    model. None for a plugin, an engine that takes no model, or no model."""
    from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY

    cls = MT_METHOD_REGISTRY.get(str(method or "").strip().lower())
    if not getattr(cls, "takes_model", False):
        return None
    given = str(model or "").strip()
    if not given and hasattr(cls, "model_source"):
        try:
            given = cls.model_source({})[0]     # e.g. $LOCAL_MODEL_ID
        except Exception:                       # none at all: the run refuses it
            return None
    if not given:
        return None
    path = Path(given).expanduser()
    if path.is_file():
        return {"kind": "file", "path": str(path.resolve())}
    if path.is_dir():
        return {"kind": "directory", "path": str(path.resolve())}
    return {"kind": "hub", "id": given}


def outside_root(paths, root) -> list[str]:
    """The ``paths`` (files or folders, existing or not) that resolve outside
    ``root`` — symlinks followed, so a link inside the project that points
    elsewhere counts as elsewhere."""
    base = Path(root).expanduser().resolve()
    out = []
    for p in paths:
        if not p:
            continue
        try:
            Path(p).expanduser().resolve().relative_to(base)
        except ValueError:
            out.append(str(p))
    return out


def local_only_write_refusal(paths, *, why: str, root, in_project: bool) -> str:
    """The refusal ``mt-eval translate`` gives for local-only output aimed
    outside the project (see the note above)."""
    where = (f"the project ({root})" if in_project else
             f"the folder this runs in ({root} — no champollion.project.json "
             f"at or above it)")
    return (f"refusing to write {', '.join(paths)}: what this method writes is "
            f"local-only ({why}), and that is outside {where} — a place the data's "
            f"holders did not choose. Only they can agree to that — ask them; if "
            f"they do: --holders-agreed-by \"<who agreed>\" (recorded in the file's "
            f"sidecar; it stays marked local-only). Or write it inside the project "
            f"(--out and -o/--output-dir)")


def _base(code: str | None) -> str:
    """A language's canonical code through the cards (en / eng / en-US →
    eng), else the lowercased base subtag."""
    c = str(code or "").replace("_", "-").strip()
    if not c:
        return ""
    try:
        from mt_eval_harness.language_cards import get_card

        card = get_card(c) or get_card(c.split("-")[0])
        if card and card.get("iso639_3"):
            return str(card["iso639_3"]).lower()
    except Exception:            # cards unavailable: the shipped code table below
        pass
    # no card at hand (offline, nothing cached): ISO 639-1 → 639-3 from the
    # table the harness ships (data/catalogue/iso639-1.json, derived from the
    # cards) — "en" and "eng" are one language with no network (2026-10-18)
    base = c.split("-")[0].lower()
    return _ISO639_1().get(base, base)


_ISO_MAP: dict | None = None


def _ISO639_1() -> dict:
    global _ISO_MAP
    if _ISO_MAP is None:
        import json as _json
        from pathlib import Path as _Path

        f = _Path(__file__).parent / "data" / "catalogue" / "iso639-1.json"
        try:
            _ISO_MAP = _json.loads(f.read_text(encoding="utf-8")).get("codes") or {}
        except (OSError, ValueError):
            _ISO_MAP = {}
    return _ISO_MAP


class ServedMethod:
    """The method, loaded once, plus what /health says about it."""

    def __init__(self, method: str, *, model: str = "", source: str, target: str,
                 gate_chain: dict | None = None, metric_plugins: list | None = None,
                 target_script: str = ""):
        from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY

        if not source or not target:
            raise ServeError("say the pair the method translates: --pair '<source>><target>' "
                             "(quoted, e.g. --pair 'eng>crk': > is a shell redirect)")
        # target_script: the script the output is written in (ISO 15924),
        # for a gate that checks it — a server has no references to read it from
        self.config = RunConfig(source_code=source, target_code=target,
                                target_script=target_script or "")
        try:
            from mt_eval_harness.language_cards import get_name

            self.config.source_lang = get_name(source) or source
            self.config.target_lang = get_name(target) or target
        except Exception:
            self.config.source_lang, self.config.target_lang = source, target
        name = (method or "").strip()
        self.identity = None
        if Path(name).expanduser().is_dir():
            from mt_eval_harness.method_loader import load_manifest, load_method

            dep = str(load_manifest(name).get("dependency_class") or "")
            if dep not in ("S", "O"):
                raise ServeError(
                    f"{name}: the plugin declares dependency class "
                    f"{dep or 'none'!r} — {NO_SERVICE}. A plugin that calls no "
                    f"API declares dependency_class S or O in its method.json")
            self.method = load_method(name)
            self.config.method_path = str(Path(name).expanduser().resolve())
            self.config.method_model = model
            self.label = getattr(self.method, "name", None) or Path(name).name
        elif name.lower() in MT_METHOD_REGISTRY:
            cls = MT_METHOD_REGISTRY[name.lower()]
            if not getattr(cls, "in_process_transport", False):
                raise ServeError(f"{name} sends what it translates to its service — {NO_SERVICE}")
            options: dict = {}
            if getattr(cls, "takes_model", False):
                from mt_eval_harness.methods.base_http_mt import MTConfigError

                try:
                    self.identity = cls.resolve_identity(
                        {"model": model}, source_code=source, target_code=target)
                except (MTConfigError, ValueError) as exc:   # ValueError: an unreadable mark
                    raise ServeError(str(exc)) from exc
                options = {"model": model, "model_identity": self.identity}
            self.method = cls(**options)
            self.config.mt_method = name.lower()
            self.config.method_model = model
            self.label = name.lower()
        else:
            raise ServeError(
                f"--method {name!r}: neither a registered engine nor a plugin "
                f"folder. {NO_SERVICE}; an LLM sends what it translates to "
                f"its provider, so it is not served here")
        self.output_local_only, self.output_local_only_why = output_local_only(self.identity)
        # who agreed it may be served off this machine (build_server)
        self.holders_agreed_by: str | None = None
        # the deployment/1 file it was loaded from, {id, sha256} (serve_deployment)
        self.deployment: dict | None = None
        self._lock = threading.Lock()
        # Gates (a gate-chain/1 document): every answer is gated before it
        # is sent. Each gate's plugin is confirmed now — a gate that cannot
        # judge stops the server from starting (mt_eval_harness.gates).
        self.gate_chain: dict | None = None
        self._gate_plugins: list = []
        self.gate_fallback = None
        if gate_chain:
            from mt_eval_harness.gates import GateError, make_fallback, resolve_gate_plugins
            plugins = metric_plugins
            if plugins is None:
                import contextlib
                import io

                from mt_eval_harness.plugin_discovery import discover_metric_plugins
                with contextlib.redirect_stdout(io.StringIO()):
                    plugins = discover_metric_plugins(self.config.to_dict(), skip_fst=True)
            try:
                # a server has no references: each gate's plugin must judge without one
                resolve_gate_plugins(gate_chain, plugins, references=False)
                # the fallback runs here too (in this process, or not at all)
                self.gate_fallback = make_fallback(gate_chain, source, target)
            except GateError as exc:
                raise ServeError(str(exc)) from exc
            self.gate_chain, self._gate_plugins = gate_chain, plugins
            fb = self.gate_fallback
            # what the fallback writes is sent too: the stricter answer holds
            if fb is not None and fb.output_local_only is True and self.output_local_only is not True:
                self.output_local_only = True
                self.output_local_only_why = f"its fallback ({fb.label}): {fb.output_local_only_why}"
            elif fb is not None and fb.output_local_only is None and self.output_local_only is False:
                self.output_local_only = None
                self.output_local_only_why = f"its fallback ({fb.label}): {fb.output_local_only_why}"

    def gate(self, sources: list[str], outs: list[tuple[str, str | None]]) -> tuple[list[dict], dict]:
        """The gate chain over one answer: (gated results, summary). A
        result's ``predicted`` is what may be sent; ``gate_verdicts`` says
        why, ``shipped_from`` what it is (method, source, fallback, nothing)."""
        from mt_eval_harness.gates import apply_gates

        results = [{"id": str(i), "source": src, "predicted": text, "error": err}
                   for i, (src, (text, err)) in enumerate(zip(sources, outs))]
        with self._lock:                       # plugins, like the method, one call at a time
            return apply_gates(results, self.gate_chain, self._gate_plugins,
                               fallback=self.gate_fallback)

    def translate(self, texts: list[str]) -> list[tuple[str, str | None]]:
        """(output, error) per text, in order."""
        field = getattr(self.config, "source_field", "source") or "source"
        entries = [{"id": str(i), field: t} for i, t in enumerate(texts)]
        with self._lock:
            results = _run_async(lambda: self.method.translate(entries, self.config))
        by_id = {str(r.get("id")): r for r in results or []}
        out = []
        for i in range(len(texts)):
            r = by_id.get(str(i)) or {}
            out.append((r.get("predicted") or "", r.get("error")))
        return out

    def health(self) -> dict:
        from mt_eval_harness.engine_model import label as model_label

        return {"status": "ok", "method": self.label,
                "model": model_label(self.identity) if self.identity else None,
                "pair": f"{self.config.source_code}→{self.config.target_code}",
                **({"deployment": self.deployment} if self.deployment else {}),
                "runs": "in this process — nothing is sent anywhere",
                "scored": "nothing — a server has no references; measure the "
                          "method with `mt-eval run` on a test set",
                "output_gates": (self._gates_line() if self.gate_chain else OUTPUT_GATES),
                **({"gates": self._gates_health()} if self.gate_chain else {}),
                "output_local_only": self.output_local_only,
                "output_local_only_why": self.output_local_only_why,
                "holders_agreed_by": self.holders_agreed_by,
                # AGPL-3.0 §13: whoever uses this server over a network is
                # offered its source (what the minimum is: IP-coach agenda)
                "license": "AGPL-3.0-or-later",
                "source": SOURCE_URL,
                "version": _harness_version()}

    def _gates_line(self) -> str:
        c = self.gate_chain
        fb = self.gate_fallback
        return (f"gate chain {c['id']}: " + "; ".join(
            f"{g['id']} — {g['metric']}.{g['field']}"
            + (f" ≥ {g['min']}" if "min" in g else "") + (f" ≤ {g['max']}" if "max" in g else "")
            + f", else {g['on_refuse']}" for g in c["gates"])
            + (f". The fallback is {fb.label}"
               + (f" ({fb.identity['id']})" if (fb.identity or {}).get("id") else "")
               + ", run here; the same gates judge what it writes" if fb else "")
            + ". A key with nothing to send comes back under `errors`; `meta.gates` lists "
              "what was refused, flagged or filled by the fallback.")

    def _gates_health(self) -> dict:
        from mt_eval_harness.gates import gate_fingerprint

        fb = self.gate_fallback
        ident = (fb.identity or {}) if fb else {}
        return {"chain_id": self.gate_chain["id"], "fingerprint": gate_fingerprint(self.gate_chain),
                "gates": [{k: g[k] for k in ("id", "metric", "field", "min", "max", "on_refuse") if k in g}
                          for g in self.gate_chain["gates"]],
                **({"fallback": {"method": fb.label,
                                 "model": {k: ident[k] for k in ("id", "kind", "sha256") if k in ident} or None,
                                 "output_local_only": fb.output_local_only}} if fb else {})}

    def check_locales(self, source, target) -> str | None:
        if source and _base(source) != _base(self.config.source_code):
            return (f"this server translates from {self.config.source_code}; the "
                    f"request asked for source_locale={source!r}")
        if target and _base(target) != _base(self.config.target_code):
            return (f"this server translates into {self.config.target_code}; the "
                    f"request asked for target_locale={target!r}")
        return None


def make_handler(served: ServedMethod, token: str | None):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):          # one quiet line per request
            pass

        def _send(self, status: int, body: dict):
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _error(self, status: int, message: str):
            self._send(status, {"error": {"message": message}})

        def _authorized(self) -> bool:
            if not token:
                return True
            got = self.headers.get("Authorization") or ""
            if got.startswith("Bearer ") and hmac.compare_digest(got[7:].strip(), token):
                return True
            self._error(401, "missing or wrong bearer token (Authorization: Bearer <token>)")
            return False

        def do_GET(self):
            if self.path.rstrip("/") == "/health":
                return self._send(200, served.health())
            return self._error(404, f"no route {self.path}")

        def do_POST(self):
            if not self._authorized():
                return None
            if self.path.rstrip("/") != "/translate":
                return self._error(404, f"no route {self.path}")
            n = int(self.headers.get("Content-Length") or 0)
            if n > MAX_BODY_BYTES:
                return self._error(413, f"request over {MAX_BODY_BYTES} bytes")
            try:
                body = json.loads(self.rfile.read(n) or b"{}")
            except ValueError:
                return self._error(400, "the body is not JSON")
            keys = body.get("keys") if isinstance(body, dict) else None
            if not isinstance(keys, dict):
                return self._error(400, "'keys' must be an object of key → source string")
            problem = served.check_locales(body.get("source_locale"), body.get("target_locale"))
            if problem:
                return self._error(400, problem)
            good = {k: v for k, v in keys.items() if isinstance(v, str) and v.strip()}
            errors = {k: {"message": "not a non-empty string"} for k in keys if k not in good}
            if len(good) > MAX_KEYS or any(len(v) > MAX_CHARS_PER_STRING for v in good.values()):
                return self._error(413, f"at most {MAX_KEYS} strings of {MAX_CHARS_PER_STRING} "
                                        "characters per request")
            names = list(good)
            try:
                outs = served.translate([good[k] for k in names])
            except Exception as exc:                   # the method failed: no partial answer
                return self._error(500, f"the method failed: {type(exc).__name__}")
            translations = {}
            gate_meta = None
            if served.gate_chain:
                # gated before anything is sent: a key with nothing to ship
                # is an error, keep-source sends the source, flag sends the
                # output and names the key, fallback sends the fallback's
                # translation when the same gates accept it
                from mt_eval_harness.gates import refusal_message

                gated, summary = served.gate([good[k] for k in names], outs)
                refused, flagged, fell_back = [], [], []
                for k, r in zip(names, gated):
                    verdicts = r.get("gate_verdicts") or []
                    if any(v["verdict"] == "refuse" for v in verdicts):
                        refused.append(k)
                    elif any(v["verdict"] == "flag" for v in verdicts):
                        flagged.append(k)
                    if r.get("shipped_from") == "fallback":
                        fell_back.append(k)
                    if r.get("shipped_from") == "nothing":
                        errors[k] = {"message": refusal_message(r)}
                        continue
                    outs[names.index(k)] = (r.get("predicted") or "", r.get("error"))
                gate_meta = {"chain": summary["chain_id"], "fingerprint": summary["fingerprint"],
                             "refused": refused, "flagged": flagged,
                             **({"fallback": fell_back} if served.gate_fallback else {})}
            for k, (text, err) in zip(names, outs):
                if k in errors:
                    continue
                if err:
                    errors[k] = {"message": str(err)[:300]}
                else:
                    translations[k] = text
            payload = {"translations": translations,
                       "meta": {"method": served.label, "served_by": "mt-eval serve",
                                "output_gates": gate_meta["chain"] if gate_meta else "none",
                                **({"gates": gate_meta} if gate_meta else {}),
                                "output_local_only": served.output_local_only}}
            if errors:
                payload["errors"] = errors
                return self._send(207, payload)
            return self._send(200, payload)

    return Handler


def build_server(served: ServedMethod, *, host: str = "127.0.0.1",
                 port: int = DEFAULT_PORT,
                 holders_agreed_by: str | None = None) -> ThreadingHTTPServer:
    token = os.environ.get(TOKEN_ENV) or None
    if host not in LOOPBACK and not token:
        raise ServeError(
            f"refusing to listen on {host} without a token — anyone who can reach "
            f"the port could use the method\n  fix: set {TOKEN_ENV}=<a long random "
            f"string> (callers send it as Authorization: Bearer …), or keep "
            f"--host 127.0.0.1 (this machine only)")
    # an address other machines reach sends what it writes off this one
    if host not in LOOPBACK and served.output_local_only is True:
        who = (holders_agreed_by or "").strip()
        if not who:
            raise ServeError(
                f"refusing to serve on {host}: what this method writes is local-only "
                f"({served.output_local_only_why}), and an address other machines can "
                f"reach sends it off this one. Only the data's holders can agree to "
                f"that — ask them; if they do: --holders-agreed-by \"<who agreed>\" "
                f"(reported on /health), or keep --host 127.0.0.1")
        served.holders_agreed_by = who
    try:
        return ThreadingHTTPServer((host, port), make_handler(served, token))
    except OSError as exc:
        raise ServeError(f"cannot listen on {host}:{port}: {exc} — pick another --port") from exc


def serve_deployment(path, *, host: str | None = None, port: int | None = None,
                     holders_agreed_by: str | None = None) -> tuple[ServedMethod, ThreadingHTTPServer]:
    """The deployment/1 file at ``path``, loaded and bound: its method,
    model, gates, pair and script, on its ``serve`` host and port unless
    ``host`` / ``port`` say otherwise. Paths in the file are the project
    root's (the current directory)."""
    from mt_eval_harness.deployment import DeploymentError, read_deployment
    from mt_eval_harness.gates import read_gate_chain

    try:
        doc, record = read_deployment(path)
    except DeploymentError as exc:
        raise ServeError(str(exc)) from exc
    pair, method = doc["pair"], doc["method"]
    served = ServedMethod(method["method"], model=method.get("model", ""),
                          source=pair["source"], target=pair["target"],
                          gate_chain=read_gate_chain(doc["gates"]) if doc.get("gates") else None,
                          target_script=pair.get("target_script", ""))
    served.deployment = {"id": record["id"], "sha256": record["sha256"]}
    serve = doc.get("serve") or {}
    httpd = build_server(served, host=host or serve.get("host") or "127.0.0.1",
                         port=port if port is not None else serve.get("port", DEFAULT_PORT),
                         holders_agreed_by=holders_agreed_by)
    return served, httpd
