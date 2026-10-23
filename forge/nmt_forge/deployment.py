"""The deployment/1 file an export writes into a rails project.

A project on the rails keeps what it deploys in ``deploy/<name>.json``
(``shared/schemas/framework/deployment.v1.schema.json``): the method, the
model, its gates and the pair. The SAME file is tested (``mt-eval run
--deployment``), run over a file (``mt-eval translate --deployment``) and
served (``mt-eval serve --deployment``), so what was measured is what ships.

``nmt-forge export`` writes one for the model it exported — ``local-model``
on the exported folder, whose ``forge-model.json`` tells mt-eval how forge
decoded it (the parity the packaged walk checks) — when the export sits in
a rails project (a ``champollion.project.json`` above it). It writes none
for a model selected under a decode hook (mt-eval does not run forge's
hooks), and never replaces a deployment of another model.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

PROJECT_FILE = "champollion.project.json"
DEPLOYMENT_SCHEMA = "https://champollion.dev/schemas/deployment/1.json"


def project_root(start: Path) -> Path | None:
    """The rails project ``start`` sits in (the nearest folder above it with
    a champollion.project.json), or None."""
    for d in [start, *start.parents]:
        if (d / PROJECT_FILE).is_file():
            return d
    return None


def write_for_export(*, model_dir: Path, name: str, source: str, target: str,
                     description: str, hook: str | None) -> dict:
    """Write ``deploy/<name>.json`` for an exported model, or say why not.

    Returns ``{"written": path}`` or ``{"skipped": why}`` — content-free, for
    the export summary. Paths in the file are the project root's."""
    root = project_root(model_dir.resolve())
    if root is None:
        return {"skipped": f"not in a rails project (no {PROJECT_FILE} above the export)"}
    if hook:
        return {"skipped": f"the model was selected under the decode hook {hook!r}, which "
                           f"only nmt-forge runs — serve it with nmt-forge serve"}
    if not source or not target:
        return {"skipped": "the config names no language pair"}
    rel = Path(os.path.relpath(model_dir.resolve(), root)).as_posix()
    doc = {"$schema": DEPLOYMENT_SCHEMA, "id": name, "description": description,
           "pair": {"source": source, "target": target},
           "method": {"method": "local-model", "model": rel}}
    from mt_eval_harness.deployment import check_deployment

    errors = check_deployment(doc)
    if errors:              # a writer that writes an invalid file is a bug: say it
        return {"skipped": "the deployment would not be valid: " + "; ".join(errors)}
    path = root / "deploy" / f"{name}.json"
    if path.is_file():
        try:
            held = (json.loads(path.read_text(encoding="utf-8")).get("method") or {}).get("model")
        except (OSError, ValueError):
            held = None
        if held != rel:
            return {"skipped": f"deploy/{name}.json already deploys "
                               f"{held or 'something unreadable'} — not replaced"}
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"written": path.relative_to(root).as_posix(), "project_root": str(root)}
