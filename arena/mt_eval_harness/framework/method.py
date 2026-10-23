"""method/1 — one translation method, as every tool reads it (on rails).

Before method/1, three unrelated documents were all called method.json: the
CLI's plugin manifest (``type``, ``locales``, ``config``), the harness's
plugin manifest (``entry_point`` and card fields) and forge's export (a CLI
manifest pointing at its server). This module reads all of them as one
shape: a method/1 document as it is, an older one as method/0 — converted to
the method/1 view with a warning, keeping the original under ``x-v0`` so
nothing is lost. The conversion is DATA
(``data/schemas/framework/method.v0-map.json``); the CLI's twin is
``cli/lib/framework/method.js``, and both are held to
``shared/test-fixtures/framework/method-vectors.json`` — one document, one
reading, in both runtimes.

Kind-specific settings (engine, model, model_dir, dictionary, entry_point,
service.endpoint) are required here, not in the schema: an error in a
method/1 document, a warning in an old one (old documents keep working).
"""

from __future__ import annotations

import json
import re
from importlib import resources
from pathlib import Path

from .mini_schema import _stringify, validate

METHOD_SCHEMA_ID = "https://champollion.dev/schemas/method/1.json"
METHOD_FILE = "method.json"

_ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
_CODE = r"[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*"
_CODE_RE = re.compile(rf"^{_CODE}$")
_PAIR_RE = re.compile(rf"^({_CODE})>({_CODE})$")
_SEMVER_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$")

_LOADED: dict = {}


def _load() -> dict:
    if not _LOADED:
        from . import FrameworkError

        def read(name):
            rel = f"data/schemas/framework/{name}"
            try:
                text = (resources.files("mt_eval_harness") / rel).read_text(encoding="utf-8")
            except (FileNotFoundError, OSError) as exc:
                raise FrameworkError(f"mt_eval_harness/{rel} is missing ({exc}); "
                                     "reinstall the harness from a tagged release.") from exc
            return json.loads(text)
        _LOADED.update(schema=read("method.v1.schema.json"),
                       map=read("method.v0-map.json"))
    return _LOADED


def _is_str(v) -> bool:
    return isinstance(v, str) and v.strip() != ""


def _is_int(v) -> bool:
    # JS Number.isInteger: an integral JSON number, never a boolean
    return (isinstance(v, int) and not isinstance(v, bool)) or (
        isinstance(v, float) and v.is_integer())


def _is_num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def slug_id(name) -> str:
    """A method id from a name: lowercase words joined by hyphens."""
    s = re.sub(r"[^a-z0-9]+", "-", str("" if name is None else name).lower()).strip("-")
    return s or "method"


def _lookup(doc, dotted: str):
    node = doc
    for key in dotted.split("."):
        node = node.get(key) if isinstance(node, dict) else None
    return node


def kind_requirement(doc) -> list[str]:
    """The one setting a kind must name, as a message, or [] when it is there."""
    kind = doc.get("kind") if isinstance(doc, dict) else None
    need = _load()["map"]["kind_requires"].get(kind) if isinstance(kind, str) else None
    if not need or _is_str(_lookup(doc, need)):
        return []
    return [f"$: kind {doc['kind']} must name its {need}"]


def check_method(doc) -> dict:
    """Check a method/1 document: the schema, then the kind's one setting."""
    if not isinstance(doc, dict):
        return {"version": None, "errors": validate(doc, {"type": "object"})["errors"],
                "warnings": []}
    errors = validate(doc, _load()["schema"])["errors"]
    return {"version": 1 if doc.get("$schema") == METHOD_SCHEMA_ID else None,
            "errors": errors + kind_requirement(doc), "warnings": []}


def method_from_v0(doc: dict) -> dict:
    """An old method.json (no $schema) as a method/1 view:
    ``{version, data, shape, errors, warnings}``."""
    m = _load()["map"]
    has_type, has_entry = "type" in doc, "entry_point" in doc
    if has_type and has_entry:
        return {"version": None, "data": None, "shape": None, "warnings": [],
                "errors": ["$: has both type (a CLI plugin manifest) and entry_point "
                           "(a harness plugin manifest) — keep one"]}
    if not has_type and not has_entry:
        return {"version": None, "data": None, "shape": None, "warnings": [],
                "errors": ["$: not a method document: no $schema (method/1), no type "
                           "(a CLI plugin manifest) and no entry_point (a harness "
                           "plugin manifest)"]}
    shape = "cli-plugin" if has_type else "harness-plugin"
    errors: list[str] = []
    warnings = [f"$: this method.json predates method/1 ("
                + ("a CLI plugin manifest" if has_type else "a harness plugin manifest")
                + ") and is read as method/0"]
    mid = doc.get("method_id")
    view: dict = {"$schema": METHOD_SCHEMA_ID,
                  "id": mid if _is_str(mid) and _ID_RE.match(mid) else slug_id(doc.get("name"))}
    if "name" in doc:
        view["name"] = doc["name"]
    if isinstance(doc.get("version"), str):
        if _SEMVER_RE.match(doc["version"]):
            view["version"] = doc["version"]
        else:
            warnings.append(f"$.version: {_stringify(doc['version'])} is not semver — left out")
    for k in ("description", "author"):
        if isinstance(doc.get(k), str):
            view[k] = doc[k]
    pairs: list[dict] = []

    if has_type:
        mapped = m["cli_types"].get(doc["type"]) if isinstance(doc["type"], str) else None
        if not mapped:
            errors.append(f"$.type: {_stringify(doc['type'])} is not a method type "
                          f"(known: {', '.join(m['cli_types'])})")
        else:
            view.update(mapped)
        cfg = doc["config"] if isinstance(doc.get("config"), dict) else {}
        if view.get("kind") in ("llm", "llm-coached") and _is_str(cfg.get("model")):
            view["model"] = cfg["model"]
        if view.get("kind") == "llm-coached":
            coaching = {}
            if _is_str(cfg.get("coachingFile")):
                coaching["file"] = cfg["coachingFile"]
            if isinstance(cfg.get("coachingPrompt"), str):
                coaching["prompt"] = cfg["coachingPrompt"]
            # a bundled coaching folder (mt-eval export --coaching-dir)
            if isinstance(doc.get("coaching"), dict) and _is_str(doc["coaching"].get("dir")):
                coaching["dir"] = doc["coaching"]["dir"]
            if coaching:
                view["coaching"] = coaching
        if view.get("kind") == "service":
            service = {}
            if isinstance(doc.get("endpoint"), str):
                service["endpoint"] = doc["endpoint"]
            if isinstance(doc.get("acceptsInstructions"), bool):
                service["accepts_instructions"] = doc["acceptsInstructions"]
            if service:
                view["service"] = service
        decode = {}
        if _is_num(cfg.get("temperature")):
            decode["temperature"] = cfg["temperature"]
        if _is_int(cfg.get("batchSize")):
            decode["batch_size"] = cfg["batchSize"]
        if decode:
            view["decode"] = decode
        for loc in doc["locales"] if isinstance(doc.get("locales"), list) else []:
            if isinstance(loc, str) and _CODE_RE.match(loc):
                pairs.append({"target": loc})
            else:
                warnings.append(f"$.locales: {_stringify(loc)} is not a language code — left out")
        prov_in = doc.get("provenance")
        if isinstance(prov_in, dict):
            prov = {}
            if isinstance(prov_in.get("resources"), list):
                prov["resources"] = prov_in["resources"]
            if isinstance(prov_in.get("flags"), list):
                prov["flags"] = prov_in["flags"]
            if prov:
                view["provenance"] = prov
            if isinstance(prov_in.get("commercialReady"), bool):
                view["card"] = {"commercial_ready": prov_in["commercialReady"]}
    else:
        view["kind"] = "python"
        if "entry_point" in doc:
            view["entry_point"] = doc["entry_point"]
        card = {f: doc[f] for f in m["harness_card_fields"] if f in doc}
        if card:
            view["card"] = card
        for p in doc["supported_pairs"] if isinstance(doc.get("supported_pairs"), list) else []:
            hit = _PAIR_RE.match(p) if isinstance(p, str) else None
            if hit:
                pairs.append({"source": hit.group(1), "target": hit.group(2)})
            else:
                warnings.append(f"$.supported_pairs: {_stringify(p)} is not "
                                "'source>target' — left out")
        if "dependency_class" in doc:
            view["dependency_class"] = doc["dependency_class"]
        if isinstance(doc.get("dependencies"), list):
            view["dependencies"] = doc["dependencies"]
    if pairs:
        view["pairs"] = pairs
    view["x-v0"] = doc
    errors.extend(validate(view, _load()["schema"])["errors"])
    warnings.extend(kind_requirement(view))
    return {"version": 0, "data": view, "shape": shape, "errors": errors,
            "warnings": warnings}


def read_method_document(doc) -> dict:
    """One parsed method.json, read: method/1 as it is, an older shape as its
    method/1 view. ``data`` is what every consumer reads."""
    if isinstance(doc, dict) and "$schema" not in doc:
        return method_from_v0(doc)
    checked = check_method(doc)
    return {"version": checked["version"], "data": doc if isinstance(doc, dict) else None,
            "shape": "method/1" if checked["version"] == 1 else None,
            "errors": checked["errors"], "warnings": []}


def read_method(file) -> dict:
    """A method.json file, read and checked. Relative paths in it (model_dir,
    dictionary, coaching.file) are relative to ``dir``, its folder."""
    p = Path(file)
    out = {"path": str(p), "dir": str(p.parent), "exists": p.is_file(),
           "version": None, "data": None, "shape": None, "errors": [], "warnings": []}
    if not out["exists"]:
        out["errors"].append(f"{p.name}: no such file")
        return out
    try:
        doc = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        kind = "JSONDecodeError" if isinstance(exc, ValueError) else "OSError"
        out["errors"].append(f"$: not readable as JSON ({kind})")
        return out
    out.update(read_method_document(doc))
    return out
