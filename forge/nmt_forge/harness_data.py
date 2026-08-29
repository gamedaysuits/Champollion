"""Harness-registry datasets as forge eval sets.

The mt-eval registry catalogues 5,600+ eval datasets (fetch-from-source,
content never hosted). Amateurs shouldn't have to hand-assemble the standard
benchmark for their pair: this bridge asks the harness to MATERIALIZE a
dataset locally (``resolve_dataset`` — the harness's own fetch-from-source
path) and registers the local file in the forge workspace, with the
registry's honesty flags stamped into the registration note:

- every registry dataset is ``do_not_train`` — registration here is for
  SCORING; the leak-audit still refuses these rows in any training mix;
- ``contamination`` grade rides along (HIGH/MEDIUM = models may have seen
  this text in pretraining → treat scores as relative-only, per the
  harness's contamination-lane policy);
- quarantined datasets are refused outright.
"""

from __future__ import annotations

from .errors import ForgeError, RegistryError
from .workspace import Workspace


def register_harness_dataset(
    workspace: Workspace,
    dataset_id: str,
    role: str = "test",
    *,
    assume_yes: bool = False,
) -> dict:
    """Materialize a harness-registry dataset and register it as an eval set."""
    from . import _harness

    _harness.load_harness()
    from mt_eval_harness.config import load_registry, resolve_dataset

    try:
        registry = load_registry()
    except Exception as e:
        raise ForgeError(
            f"mt-eval registry unavailable ({type(e).__name__}: {e})\n"
            "  fix: run inside the monorepo, or install a harness build that "
            "bundles the registry, or set MT_EVAL_REGISTRY_URL"
        ) from e
    entry = next((d for d in registry.get("datasets", [])
                  if d.get("id") == dataset_id), None)
    if entry is None:
        raise ForgeError(
            f"no dataset {dataset_id!r} in the mt-eval registry",
            )
    if entry.get("quarantine"):
        raise RegistryError(
            f"dataset {dataset_id!r} is QUARANTINED in the registry "
            f"({entry.get('quarantine_reason', 'no reason recorded')}) — "
            "quarantined sets never rank and never register here"
        )
    try:
        path = resolve_dataset(dataset_id, assume_yes=assume_yes,
                               skip_eval_pack=True)
    except Exception as e:
        raise ForgeError(
            f"could not materialize {dataset_id!r}: {e}\n"
            "  fix: the harness fetches datasets from their sources — check "
            "network/credentials; pass assume_yes=True (--yes) to accept "
            "its prompts non-interactively"
        ) from e
    note = (f"mt-eval registry dataset (contamination: "
            f"{entry.get('contamination', 'unknown')}; do_not_train: "
            f"{entry.get('do_not_train')}). HIGH/MEDIUM contamination ⇒ "
            "treat scores as relative-only.")
    reg_entry = workspace.registry.register(dataset_id, path, role, note=note)
    return {"registered": dataset_id, "role": role, "path": str(path),
            "contamination": entry.get("contamination"),
            "do_not_train": entry.get("do_not_train"),
            "rows": reg_entry["rows"], "note": note}
