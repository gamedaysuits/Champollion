"""Deployments — one document says what is deployed, and every mode reads it.

Founder, 2026-10-09: deployment is the eval pipeline on source-only input.
A deployment/1 file (``shared/schemas/framework/deployment.v1.schema.json``)
names one method (and its model or dictionary), its gate chain, and the
pair. The SAME file is

* tested on a test set — ``mt-eval run --deployment deploy/x.json --corpus
  test.json`` (what is measured is what ships),
* run over a file — ``mt-eval translate --deployment …``,
* served — ``mt-eval serve --deployment …``.

Paths in it are relative to the project's root, where the rails run
commands. A deployment names no score: a measured number is a run result,
kept with the run (whose config records the deployment's id and sha256).
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from mt_eval_harness.framework import SCHEMA_IDS, check_document

DEPLOYMENT_SCHEMA_ID = SCHEMA_IDS["deployment"]


class DeploymentError(ValueError):
    """A deployment file that cannot be used as it is."""


def check_deployment(doc) -> list[str]:
    """Errors (empty when it holds) for a parsed deployment/1 document — the
    framework reader's verdict, the one `champollion validate` gives too."""
    return check_document(doc, "deployment")["errors"]


def read_deployment(path) -> tuple[dict, dict]:
    """(the deployment, its record) — checked, its gate chain read and
    checked too; raises DeploymentError with every problem. The record
    ``{path, id, sha256}`` is what a run keeps of it."""
    p = Path(path)
    try:
        raw = p.read_bytes()
        doc = json.loads(raw.decode("utf-8"))
    except FileNotFoundError as exc:
        raise DeploymentError(f"{path}: no such deployment file") from exc
    except (UnicodeDecodeError, ValueError) as exc:
        raise DeploymentError(f"{path}: not JSON ({exc})") from exc
    errors = check_deployment(doc)
    if errors:
        raise DeploymentError(f"{p.name} is not a valid deployment/1 document: " + "; ".join(errors))
    if doc.get("gates"):
        from mt_eval_harness.gates import GateError, read_gate_chain
        try:
            read_gate_chain(doc["gates"])
        except GateError as exc:
            raise DeploymentError(f"{p.name}: its gates — {exc}") from exc
    record = {"path": str(p.resolve()), "id": doc["id"],
              "sha256": hashlib.sha256(raw).hexdigest()}
    return doc, record


def _base(code: str) -> str:
    return str(code or "").replace("_", "-").split("-")[0].lower()


def pair_mismatch(doc: dict, source: str, target: str) -> str | None:
    """Why a run on (source, target) is not a run of this deployment, or None."""
    want = doc["pair"]
    if source and _base(source) != _base(want["source"]):
        return (f"deployment {doc['id']} translates from {want['source']}; this "
                f"input is in {source}")
    if target and _base(target) != _base(want["target"]):
        return (f"deployment {doc['id']} translates into {want['target']}; this "
                f"input's target is {target}")
    return None


#: run / translate flags a deployment decides — given with --deployment, refused
DEPLOYMENT_DECIDES = (("method", "--method"), ("model_given", "-m/--model"),
                      ("gates", "--gates"), ("target_script", "--target-script"))


def apply_to_run_args(args) -> dict:
    """Fill a run's / translate's method, model, gates and target script
    from ``args.deployment``; returns the deployment's record. A flag the
    deployment decides, given as well, is refused — the file is the one
    place it is said."""
    doc, record = read_deployment(args.deployment)
    given = [flag for attr, flag in DEPLOYMENT_DECIDES if getattr(args, attr, None)]
    if given:
        raise DeploymentError(
            f"--deployment {Path(args.deployment).name} says the method, its model, its "
            f"gates and the target script; drop {', '.join(given)} (or change the file)")
    args.method = doc["method"]["method"]
    if doc["method"].get("model"):
        args.model, args.model_given = doc["method"]["model"], True
    args.gates = doc.get("gates")
    args.target_script = doc["pair"].get("target_script", "")
    return dict(record, pair=dict(doc["pair"]))
