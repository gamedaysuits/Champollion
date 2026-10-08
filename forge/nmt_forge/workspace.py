"""Workspace — the on-disk spine shared by every guard.

A workspace is a directory (conventionally ``<project>/.forge``) holding:

    eval-registry.json      which files are eval sets (name, path, sha, role)
    ledger.jsonl            append-only hash-chained event log
    preregistrations/       predictions-before-results files
    runs/<run-id>/          run manifests (config hash, data shas, reports)

Everything in a workspace is CONTENT-FREE: hashes, counts, paths, parameters
— never sentence text. A workspace is safe to commit; the eval files it
points at follow their own hosting rules (corpus content is never tracked in
Champollion repos).
"""

from __future__ import annotations

from pathlib import Path

from .ledger import Ledger
from .registry import EvalRegistry


class Workspace:
    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.ledger = Ledger(self.root / "ledger.jsonl")
        self.registry = EvalRegistry(self.root / "eval-registry.json", self.ledger)
        self.prereg_dir = self.root / "preregistrations"
        self.prereg_dir.mkdir(exist_ok=True)
        self.runs_dir = self.root / "runs"
        self.runs_dir.mkdir(exist_ok=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"Workspace({str(self.root)!r})"
