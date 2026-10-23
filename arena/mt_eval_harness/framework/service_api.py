"""service-api/1 — the ``/translate`` contract, checkable.

One contract between a translation service and what calls it, written down
once: ``shared/schemas/framework/service-api.v1.schema.json`` (bundled here
under ``data/schemas/framework/``, parity-tested). Servers: ``nmt-forge
serve``, ``mt-eval serve``, or anyone's (a method of kind ``service``);
client: the champollion CLI's ``api`` method.

``check_body`` validates one answer against one part of the contract with
the same dependency-free validator every framework document uses.
``run_vectors`` runs ``shared/test-fixtures/framework/service-api-vectors.json``
against a live server by URL and returns what did not hold — keys, statuses
and schema paths only, never the text it translated. Both servers here are
held to it in their own suites; a service written elsewhere can be too.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from importlib import resources

from .mini_schema import validate

SCHEMA_ID = "https://champollion.dev/schemas/service-api/1.json"
PARTS = ("translate_request", "translate_response", "error_response", "health")
_SCHEMA: dict = {}


def schema() -> dict:
    """The parsed service-api/1 schema (bundled with the harness)."""
    if not _SCHEMA:
        rel = "data/schemas/framework/service-api.v1.schema.json"
        _SCHEMA.update(json.loads((resources.files("mt_eval_harness") / rel)
                                  .read_text(encoding="utf-8")))
    return _SCHEMA


def check_body(body, part: str) -> list[str]:
    """Errors (empty when it holds) for ``body`` as one part of the contract."""
    if part not in PARTS:
        raise ValueError(f"unknown service-api/1 part {part!r} (known: {', '.join(PARTS)})")
    return validate(body, {"$ref": f"#/$defs/{part}", "$defs": schema()["$defs"]})["errors"]


def _fill(value, slots: dict):
    if isinstance(value, str):
        return slots.get(value, value)
    if isinstance(value, list):
        return [_fill(v, slots) for v in value]
    if isinstance(value, dict):
        return {k: _fill(v, slots) for k, v in value.items()}
    return value


def _call(base: str, request: dict, slots: dict, token: str | None, timeout: float):
    data = None
    if "raw" in request:
        data = request["raw"].encode("utf-8")
    elif "body" in request:
        data = json.dumps(_fill(request["body"], slots)).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(base.rstrip("/") + request["path"], data=data,
                                 headers=headers, method=request["method"])
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            status, raw = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read()
    try:
        return status, json.loads(raw)
    except ValueError:
        return status, None


def run_vectors(base_url: str, vectors: dict, *, source: str, target: str,
                other: str, word: str, token: str | None = None,
                timeout: float = 60) -> list[str]:
    """Run the contract's vectors against the server at ``base_url``.

    ``source``/``target`` are the server's pair, ``other`` a language it does
    not translate into, ``word`` a source string it can translate. Returns
    one line per thing that did not hold; an empty list means the server
    follows service-api/1.
    """
    slots = {"{source}": source, "{target}": target, "{other}": other, "{word}": word}
    failures: list[str] = []
    answers: list[dict] = []
    for case in vectors["cases"]:
        name, want = case["name"], case["expect"]
        status, body = _call(base_url, case["request"], slots, token, timeout)
        if status != want["status"]:
            failures.append(f"{name}: status {status}, the contract says {want['status']}")
        if body is None:
            failures.append(f"{name}: the answer is not JSON")
            continue
        failures += [f"{name}: {e}" for e in check_body(body, want["body"])]
        if want["body"] == "translate_response" and isinstance(body, dict):
            answers.append(body)
            for field in ("translated", "errors"):
                got = sorted((body.get("translations" if field == "translated" else "errors") or {}))
                if field in want and got != sorted(want[field]):
                    failures.append(f"{name}: {field} keys {got}, the contract says {sorted(want[field])}")
    _, health = _call(base_url, {"method": "GET", "path": "/health"}, slots, token, timeout)
    if isinstance(health, dict) and health.get("output_local_only") is True:
        for body in answers:
            if (body.get("meta") or {}).get("output_local_only") is not True:
                failures.append("its /health says output_local_only true, but a translate answer's "
                                "meta does not (every answer must say so)")
                break
    return failures
