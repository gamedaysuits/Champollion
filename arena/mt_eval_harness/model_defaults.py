"""model_defaults — the ONE place a default model comes from (harness side).

Every default model in the toolset is written once, in
shared/model-defaults.json (bundled here as mt_eval_harness/data/
model-defaults.json, kept identical by tests/test_model_defaults.py). The CLI
reads the same file (cli/lib/model-defaults.js). A default is an exact id,
never resolved at run time: a run must say which model produced it.
`champollion models check` compares the file with the providers' live lists.

A missing or malformed file is a broken install and fails loud: the harness
must not guess a model.
"""

from __future__ import annotations

import json
from importlib import resources

RESOURCE = "data/model-defaults.json"


class ModelDefaultsError(RuntimeError):
    """The bundled model-defaults file is missing or malformed."""


def model_defaults() -> dict:
    """The parsed roles table."""
    try:
        text = (resources.files("mt_eval_harness") / RESOURCE).read_text(encoding="utf-8")
    except (FileNotFoundError, OSError) as exc:
        raise ModelDefaultsError(
            f"mt_eval_harness/{RESOURCE} is missing ({exc}); it names every default "
            "model. Reinstall the harness from a tagged release.") from exc
    data = json.loads(text)
    if not isinstance(data.get("roles"), dict):
        raise ModelDefaultsError(f"mt_eval_harness/{RESOURCE} has no 'roles'.")
    return data["roles"]


def default_model(role: str) -> str:
    """The exact default model id for a role ('translate', 'harness', …)."""
    roles = model_defaults()
    if role not in roles or not roles[role].get("model"):
        raise ModelDefaultsError(f"model-defaults.json has no '{role}' role.")
    return roles[role]["model"]
