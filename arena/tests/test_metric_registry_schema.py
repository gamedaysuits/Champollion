"""
Schema guard for the metric-identity registry: shared/metric-registry.json AND
its bundled copies (cli/shared/, and arena/mt_eval_harness/data/ where that
exists) must all validate against
shared/schemas/metric-registry.schema.json.

The shape tests in test_metric_registry_ssot.py check what the harness reads;
nothing checked the file against its own schema, so all four _proposed_renames
entries carried free-text decisions outside the schema's enum unnoticed.

The harness ships no jsonschema dependency, so this file carries a small
draft-07 validator covering exactly the keywords the registry schema uses. It
refuses any keyword it does not enforce, so a schema that grows a new keyword
fails here instead of passing unchecked.

Skips cleanly in a standalone pip install where shared/ isn't present.
"""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path

import pytest

_REPO = Path(__file__).resolve().parents[2]
_SCHEMA = _REPO / "shared" / "schemas" / "metric-registry.schema.json"
_COPIES = {
    "shared": _REPO / "shared" / "metric-registry.json",
    "cli-bundle": _REPO / "cli" / "shared" / "metric-registry.json",
    # The wheel-bundled copy (branch scoring-v2); skipped until it exists.
    "harness-data": _REPO / "arena" / "mt_eval_harness" / "data" / "metric-registry.json",
}

# Keywords that carry no constraint.
_ANNOTATIONS = {"$schema", "$id", "$defs", "$comment", "title", "description"}
_ENFORCED = {
    "type", "enum", "pattern", "minLength", "minimum", "maximum", "required",
    "properties", "additionalProperties", "items", "$ref",
    "minProperties", "propertyNames", "oneOf", "minItems", "maxItems",
}


def _type_ok(value, t: str) -> bool:
    if t == "null":
        return value is None
    if t == "boolean":
        return isinstance(value, bool)
    if t == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if t == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if t == "string":
        return isinstance(value, str)
    if t == "array":
        return isinstance(value, list)
    if t == "object":
        return isinstance(value, dict)
    raise AssertionError(f"schema uses unknown type {t!r}")


def _resolve(ref: str, root: dict) -> dict:
    assert ref.startswith("#/"), f"only local $refs are supported, got {ref!r}"
    node = root
    for seg in ref[2:].split("/"):
        node = node[seg]
    return node


def _validate(value, schema: dict, root: dict, path: str, errors: list[str]) -> None:
    unknown = set(schema) - _ANNOTATIONS - _ENFORCED
    assert not unknown, (
        f"{path}: schema keyword(s) {sorted(unknown)} are not enforced by this "
        f"test's validator — extend it before relying on them")

    if "$ref" in schema:
        _validate(value, _resolve(schema["$ref"], root), root, path, errors)
        return

    if "oneOf" in schema:
        matches = 0
        for branch in schema["oneOf"]:
            branch_errors: list[str] = []
            _validate(value, branch, root, path, branch_errors)
            matches += not branch_errors
        if matches != 1:
            errors.append(f"{path}: matches {matches} oneOf branches, expected exactly 1")

    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_type_ok(value, t) for t in types):
            errors.append(f"{path}: expected type {'|'.join(types)}, got {type(value).__name__}")
            return

    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in enum {schema['enum']}")

    if isinstance(value, str):
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append(f"{path}: {value!r} does not match /{schema['pattern']}/")
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{path}: shorter than minLength {schema['minLength']}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: {value} < minimum {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}: {value} > maximum {schema['maximum']}")

    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}: shorter than minItems {schema['minItems']}")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: longer than maxItems {schema['maxItems']}")

    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            _validate(item, schema["items"], root, f"{path}[{i}]", errors)

    if isinstance(value, dict):
        for req in schema.get("required", []):
            if req not in value:
                errors.append(f"{path}: missing required property {req!r}")
        if "minProperties" in schema and len(value) < schema["minProperties"]:
            errors.append(f"{path}: fewer than {schema['minProperties']} properties")
        props = schema.get("properties", {})
        extra = schema.get("additionalProperties", True)
        for key, sub in value.items():
            if "propertyNames" in schema:
                _validate(key, schema["propertyNames"], root, f"{path} key {key!r}", errors)
            if key in props:
                _validate(sub, props[key], root, f"{path}.{key}", errors)
            elif extra is False:
                errors.append(f"{path}: unexpected property {key!r}")
            elif isinstance(extra, dict):
                _validate(sub, extra, root, f"{path}.{key}", errors)


def _errors(data) -> list[str]:
    schema = json.loads(_SCHEMA.read_text(encoding="utf-8"))
    errors: list[str] = []
    _validate(data, schema, schema, "$", errors)
    return errors


def _load(path: Path):
    if not path.exists():
        pytest.skip(f"{path.relative_to(_REPO)} not found (standalone install)")
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize("copy_name", sorted(_COPIES))
def test_registry_copy_validates_against_schema(copy_name):
    if not _SCHEMA.exists():
        pytest.skip("shared/schemas/metric-registry.schema.json not found (standalone install)")
    errors = _errors(_load(_COPIES[copy_name]))
    assert errors == [], f"{copy_name} copy violates the schema:\n" + "\n".join(errors)


def test_validator_catches_the_decision_enum_violation():
    """A free-text decision in a PENDING proposal must fail — the defect this guards."""
    if not _SCHEMA.exists():
        pytest.skip("shared/schemas/metric-registry.schema.json not found (standalone install)")
    data = copy.deepcopy(_load(_COPIES["shared"]))
    data["_proposed_renames"] = [{
        "current": "x", "proposal": "y", "impact": "z",
        "decision": "KEEP (2026-07-07) — no rename",
    }]
    assert any("_proposed_renames[0].decision" in e and "not in enum" in e
               for e in _errors(data))


def test_validator_checks_every_entry_and_key():
    if not _SCHEMA.exists():
        pytest.skip("shared/schemas/metric-registry.schema.json not found (standalone install)")
    data = copy.deepcopy(_load(_COPIES["shared"]))
    first = next(iter(data["entries"]))
    data["entries"][first]["direction"] = "sideways"
    data["entries"]["Bad-Key"] = data["entries"][first]
    errs = _errors(data)
    assert any(f".entries.{first}.direction" in e for e in errs), errs
    assert any("key 'Bad-Key'" in e for e in errs), errs
