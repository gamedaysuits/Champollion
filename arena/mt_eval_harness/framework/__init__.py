"""The framework's documents, read the same way in every tool (on rails).

A project on the rails is a folder of plain files every tool reads natively —
no bridge code between tools. This module is the harness's ONE reader for
them; the CLI's twin is ``cli/lib/framework/index.js``. Both validate against
the schemas in ``shared/schemas/framework/`` (bundled here under
``data/schemas/framework/``, parity-tested) with validators that give
identical messages, held to ``shared/test-fixtures/framework/``.

Document types — each added when a command first needs it:

- **project/1** — ``champollion.project.json`` at a project's root: decisions
  only (kind, name, pair, purpose, defaults).
- **set/1** — ``<file>.champollion.json`` beside any data file: role, kind,
  terms (training allowed or not, owner, consent record) and where the text
  may go. A sidecar written before set/1 has no ``$schema`` and is read as
  set/0: its fields are checked, and a key set/1 would not know is a
  WARNING (old sidecars must keep working), never a silent pass.
- **gate-chain/1** — ``gates/<name>.json``: checks between a method's output
  and what ships (``mt_eval_harness.gates``).
- **deployment/1** — ``deploy/<name>.json``: one method, its gates, for one
  pair — what run, translate and serve read (``mt_eval_harness.deployment``).

Every message is content-free: it names keys and values of the document,
never a sentence from a data file.
"""

from __future__ import annotations

import json
from importlib import resources
from pathlib import Path

from .mini_schema import validate

PROJECT_FILE = "champollion.project.json"
SIDECAR_SUFFIX = ".champollion.json"

SCHEMA_IDS = {
    "project": "https://champollion.dev/schemas/project/1.json",
    "set": "https://champollion.dev/schemas/set/1.json",
    "gate-chain": "https://champollion.dev/schemas/gate-chain/1.json",
    "deployment": "https://champollion.dev/schemas/deployment/1.json",
}
_SCHEMA_FILES = {
    "project": "project.v1.schema.json",
    "set": "set.v1.schema.json",
    "gate-chain": "gate-chain.v1.schema.json",
    "deployment": "deployment.v1.schema.json",
}
#: the folders a project keeps these in, one document per .json file
_FOLDER_TYPES = (("gates", "gate-chain"), ("deploy", "deployment"))
#: project kinds that translate a pair, so must name it
_PAIRED_KINDS = ("language", "task", "service")

#: folders never searched for sidecars (mirrors cli/lib/local-only-marks.js)
SKIP_DIRS = frozenset({
    "node_modules", ".git", ".hg", ".svn", ".champollion", ".venv", "venv",
    "__pycache__", ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache",
    ".pytest_cache", ".mypy_cache", ".tox",
})


class FrameworkError(RuntimeError):
    """A framework schema is missing from this install."""


_SCHEMAS: dict[str, dict] = {}


def schema_for(type_name: str) -> dict:
    """The parsed schema for a document type ('project', 'set')."""
    if type_name not in _SCHEMA_FILES:
        raise FrameworkError(f"unknown framework document type {type_name!r} "
                             f"(known: {', '.join(sorted(_SCHEMA_FILES))})")
    if type_name not in _SCHEMAS:
        rel = f"data/schemas/framework/{_SCHEMA_FILES[type_name]}"
        try:
            text = (resources.files("mt_eval_harness") / rel).read_text(encoding="utf-8")
        except (FileNotFoundError, OSError) as exc:
            raise FrameworkError(
                f"mt_eval_harness/{rel} is missing ({exc}); reinstall the "
                "harness from a tagged release.") from exc
        _SCHEMAS[type_name] = json.loads(text)
    return _SCHEMAS[type_name]


def check_document(doc, type_name: str) -> dict:
    """Validate one parsed document.

    Returns ``{"type", "version", "errors", "warnings"}``. ``version`` is 1
    for a document carrying the set/1 or project/1 ``$schema`` and 0 for a
    sidecar written before set/1. ``errors`` mean the document is not valid;
    ``warnings`` mean it is valid but something should change.
    """
    schema = schema_for(type_name)
    if not isinstance(doc, dict):
        got = validate(doc, {"type": "object"})["errors"]
        return {"type": type_name, "version": None, "errors": got, "warnings": []}

    declared = doc.get("$schema")
    version = 1 if declared == SCHEMA_IDS[type_name] else (
        0 if declared is None and type_name == "set" else None)
    result = validate(doc, schema)
    errors, warnings = [], []
    for err in result["errors"]:
        if version == 0 and err.startswith("$: unexpected property '"):
            key = err[len("$: unexpected property '"):-1]
            warnings.append(
                f"$: unknown key '{key}' — kept (this sidecar predates set/1), "
                f"but set/1 refuses it: rename it 'x-{key}' or remove it")
        else:
            errors.append(err)
    if type_name == "project" and doc.get("kind") in _PAIRED_KINDS and "pair" not in doc:
        errors.append(f"$: a {doc['kind']} project must name its pair "
                      "(pair.source and pair.target)")
    if type_name == "gate-chain" and not errors:
        errors += _gate_chain_rules(doc)
    return {"type": type_name, "version": version, "errors": errors,
            "warnings": warnings}


def _gate_chain_rules(doc: dict) -> list[str]:
    """What gate-chain/1's schema cannot say (the JS twin says it the same)."""
    errors = []
    ids = [g["id"] for g in doc["gates"]]
    for i, gate in enumerate(doc["gates"]):
        if "min" not in gate and "max" not in gate:
            errors.append(f"$.gates[{i}]: a metric-threshold gate needs min and/or max")
        if ids.count(gate["id"]) > 1:
            errors.append(f"$.gates[{i}]: gate id '{gate['id']}' appears twice")
        if gate["on_refuse"] == "fallback" and not doc.get("fallback"):
            errors.append(f"$.gates[{i}]: on_refuse fallback needs the chain's fallback "
                          f"(\"fallback\": {{\"method\": \"lexicon\", \"model\": \"<dictionary>\"}})")
    return errors


def read_set(data_path) -> dict:
    """The set sidecar beside ``data_path``, read and checked.

    Returns ``{"path", "exists", "version", "data", "errors", "warnings"}``.
    An unreadable sidecar is an ERROR, never skipped: a steward wrote it to
    restrict the data, and a typo must not make the data unrestricted.
    """
    side = Path(str(data_path) + SIDECAR_SUFFIX)
    out = {"path": str(side), "exists": side.is_file(), "version": None,
           "data": None, "errors": [], "warnings": []}
    if not out["exists"]:
        return out
    try:
        data = json.loads(side.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        kind = "JSONDecodeError" if isinstance(exc, ValueError) else "OSError"
        out["errors"].append(f"$: not readable as JSON ({kind}) — "
                             "fix the file; it states how this data may be used")
        return out
    checked = check_document(data, "set")
    out.update(version=checked["version"], data=data, errors=checked["errors"],
               warnings=checked["warnings"])
    return out


def project_root(start) -> Path | None:
    """The rails project ``start`` sits in: the nearest folder at or above it
    holding a ``champollion.project.json``, or None (nmt-forge's
    ``deployment.project_root`` is the same rule)."""
    start = Path(start).expanduser().resolve()
    for d in [start, *start.parents]:
        if (d / PROJECT_FILE).is_file():
            return d
    return None


def _sidecars(root: Path):
    for path in sorted(root.rglob("*" + SIDECAR_SUFFIX)):
        rel = path.relative_to(root)
        if any(part in SKIP_DIRS for part in rel.parts[:-1]):
            continue
        if path.name == PROJECT_FILE:
            continue
        yield path


def check_project(root) -> dict:
    """Check a project folder: its ``champollion.project.json`` (if any) and
    every data sidecar under it.

    Returns ``{"root", "project", "sets", "ok"}`` where ``project`` is
    ``{"path", "exists", ...check_document fields}`` and each entry of
    ``sets`` is a :func:`read_set` result keyed by the data file it
    describes. ``ok`` is False when any document has an error.
    """
    root = Path(root)
    pfile = root / PROJECT_FILE
    project = {"path": str(pfile), "exists": pfile.is_file(), "type": "project",
               "version": None, "errors": [], "warnings": []}
    if project["exists"]:
        try:
            doc = json.loads(pfile.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            kind = "JSONDecodeError" if isinstance(exc, ValueError) else "OSError"
            project["errors"].append(f"$: not readable as JSON ({kind})")
        else:
            project.update(check_document(doc, "project"))
    sets = []
    for side in _sidecars(root):
        data_file = str(side)[: -len(SIDECAR_SUFFIX)]
        entry = read_set(data_file)
        entry["data_file"] = Path(data_file).relative_to(root).as_posix()
        entry.pop("data", None)   # the report never carries sidecar values
        sets.append(entry)
    # one order in both runtimes (the JS twin sorts the same way)
    sets.sort(key=lambda s: s["data_file"])
    methods = []
    for f in method_files(root):
        from .method import read_method

        entry = read_method(f)
        entry["file"] = f.relative_to(root).as_posix()
        entry.pop("data", None)
        entry.pop("dir", None)
        methods.append(entry)
    documents = folder_documents(root)
    ok = (not project["errors"] and not any(s["errors"] for s in sets)
          and not any(m["errors"] for m in methods)
          and not any(d["errors"] for d in documents))
    return {"root": str(root), "project": project, "sets": sets,
            "methods": methods, "documents": documents, "ok": ok}


def folder_documents(root) -> list[dict]:
    """The gate chains (gates/*.json) and deployments (deploy/*.json) a
    project holds, each checked: ``{file, type, version, errors, warnings}``,
    sorted by path. An unreadable one is an error, never skipped."""
    root = Path(root)
    out = []
    for folder, type_name in _FOLDER_TYPES:
        for f in sorted((root / folder).glob("*.json")):
            if f.name.endswith(SIDECAR_SUFFIX) or not f.is_file():
                continue
            entry = {"file": f.relative_to(root).as_posix(), "type": type_name,
                     "version": None, "errors": [], "warnings": []}
            try:
                doc = json.loads(f.read_text(encoding="utf-8"))
            except (OSError, ValueError) as exc:
                kind = "JSONDecodeError" if isinstance(exc, ValueError) else "OSError"
                entry["errors"].append(f"$: not readable as JSON ({kind})")
            else:
                entry.update(check_document(doc, type_name))
            out.append(entry)
    return sorted(out, key=lambda d: d["file"])


def method_files(root) -> list[Path]:
    """The method.json files a project holds: at its root, under methods/
    and under .champollion/methods/ — sorted by their path."""
    root = Path(root)
    found = [root / "method.json"] + sorted(root.glob("methods/*/method.json")) \
        + sorted(root.glob(".champollion/methods/*/method.json"))
    return sorted((f for f in found if f.is_file()),
                  key=lambda f: f.relative_to(root).as_posix())
