"""A dependency-free JSON Schema (draft 2020-12 subset) validator.

The Python twin of the CLI's ``cli/lib/mini-schema.mjs``. The repo ships no
jsonschema/ajv in either runtime; instead both runtimes carry this small,
auditable validator, and both are held to the same vectors
(``shared/test-fixtures/framework/schema-vectors.json``) — the SAME error
strings, so the CLI and the harness can never judge one document
differently. Change one, change the other, and let the vectors confirm it.

Covers exactly: type (incl. arrays-of-types and null), required, enum,
pattern, properties, patternProperties, additionalProperties:false, items,
$ref ("#/$defs/..."), minimum/maximum, minLength, minItems/maxItems, oneOf.

Two JavaScript behaviours are reproduced on purpose: a float with no
fractional part is an ``integer`` (JSON ``2.0`` parses to the JS number 2),
and ``minLength`` counts UTF-16 code units (JS ``string.length``).
"""

from __future__ import annotations

import json
import re
from typing import Any


def _type_of(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "integer" if value.is_integer() else "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def _matches_type(value: Any, type_name: str) -> bool:
    actual = _type_of(value)
    if type_name == "number":
        return actual in ("number", "integer")
    return actual == type_name


def _js_number(value: Any) -> Any:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, list):
        return [_js_number(v) for v in value]
    if isinstance(value, dict):
        return {k: _js_number(v) for k, v in value.items()}
    return value


def _stringify(value: Any) -> str:
    """JSON.stringify, as the JS twin prints it."""
    return json.dumps(_js_number(value), ensure_ascii=False,
                      separators=(",", ":"))


def _num(value: Any) -> str:
    """A number as JS template literals print it."""
    v = _js_number(value)
    return "true" if v is True else "false" if v is False else str(v)


def _utf16_len(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def _resolve_ref(ref: str, root: dict) -> Any:
    if not ref.startswith("#/"):
        raise ValueError(f"mini-schema: unsupported $ref '{ref}' (only local #/ refs)")
    node: Any = root
    for seg in ref[2:].split("/"):
        node = node.get(seg) if isinstance(node, dict) else None
        if node is None:
            raise ValueError(f"mini-schema: unresolved $ref '{ref}'")
    return node


def _validate_node(value: Any, schema: dict, root: dict, path: str,
                   errors: list[str]) -> None:
    if "$ref" in schema:
        _validate_node(value, _resolve_ref(schema["$ref"], root), root, path, errors)
        return

    if "oneOf" in schema:
        matches = 0
        for branch in schema["oneOf"]:
            branch_errors: list[str] = []
            _validate_node(value, branch, root, path, branch_errors)
            if not branch_errors:
                matches += 1
        if matches != 1:
            errors.append(f"{path}: matches {matches} oneOf branches, expected exactly 1")

    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_matches_type(value, t) for t in types):
            errors.append(f"{path}: expected type {'|'.join(types)}, got {_type_of(value)}")
            return

    if "enum" in schema and not any(
            e == value and _type_of(e) == _type_of(value) for e in schema["enum"]):
        errors.append(f"{path}: {_stringify(value)} not in enum {_stringify(schema['enum'])}")

    kind = _type_of(value)

    if kind == "string":
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append(f"{path}: '{value}' does not match pattern /{schema['pattern']}/")
        if "minLength" in schema and _utf16_len(value) < schema["minLength"]:
            errors.append(f"{path}: string shorter than minLength {_num(schema['minLength'])}")

    if kind in ("number", "integer"):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: {_num(value)} < minimum {_num(schema['minimum'])}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}: {_num(value)} > maximum {_num(schema['maximum'])}")

    if kind == "array":
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}: array shorter than minItems {_num(schema['minItems'])}")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: array longer than maxItems {_num(schema['maxItems'])}")
        if "items" in schema:
            for i, item in enumerate(value):
                _validate_node(item, schema["items"], root, f"{path}[{i}]", errors)

    if kind == "object":
        for req in schema.get("required", []):
            if req not in value:
                errors.append(f"{path}: missing required property '{req}'")
        props = schema.get("properties", {})
        patterns = [(re.compile(p), sub)
                    for p, sub in schema.get("patternProperties", {}).items()]
        if schema.get("additionalProperties") is False:
            for key in value:
                if key not in props and not any(rx.search(key) for rx, _ in patterns):
                    errors.append(f"{path}: unexpected property '{key}'")
        for key, sub in props.items():
            if key in value:
                _validate_node(value[key], sub, root, f"{path}.{key}", errors)
        for key in value:
            for rx, sub in patterns:
                if rx.search(key):
                    _validate_node(value[key], sub, root, f"{path}.{key}", errors)


def validate(data: Any, schema: dict) -> dict:
    """``{"valid": bool, "errors": [str]}`` — the JS twin's return shape."""
    errors: list[str] = []
    _validate_node(data, schema, schema, "$", errors)
    return {"valid": not errors, "errors": errors}
