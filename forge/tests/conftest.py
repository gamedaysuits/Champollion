"""Shared fixtures.

Fixture discipline (quarantine-gate aware): ALL corpus-shaped test data is
built in Python code at test runtime and written to tmp_path — never tracked
as .json/.jsonl fixture files. Text uses invented tokens; no real corpus
content anywhere in this suite.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

FORGE_DIR = Path(__file__).resolve().parents[1]
if str(FORGE_DIR) not in sys.path:
    sys.path.insert(0, str(FORGE_DIR))

from nmt_forge.workspace import Workspace  # noqa: E402


def write_jsonl(path: Path, rows: list[dict]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
        encoding="utf-8",
    )
    return path


@pytest.fixture
def ws(tmp_path) -> Workspace:
    return Workspace(tmp_path / ".forge")


def toy_pairs(n: int = 30, prefix: str = "row") -> list[dict]:
    """n distinct pairs with invented tokens (no shared sources/targets)."""
    return [
        {"source": f"the {prefix}{i} wug runs today", "target": f"wugto{i} blar nem"}
        for i in range(n)
    ]


@pytest.fixture
def test_set(ws, tmp_path):
    """A registered test-role eval set (12 rows) + its rows."""
    rows = [
        {"source": f"see the tozer {i} clearly", "reference": f"tozka{i} miv rel"}
        for i in range(12)
    ]
    path = write_jsonl(tmp_path / "eval" / "toy-test.jsonl", rows)
    ws.registry.register("toy-test", path, "test")
    return rows


@pytest.fixture
def dev_set(ws, tmp_path):
    """A registered dev-role eval set (8 rows) + its rows."""
    rows = [
        {"source": f"the dax {i} sleeps now", "reference": f"daxko{i} pel sun"}
        for i in range(8)
    ]
    path = write_jsonl(tmp_path / "eval" / "toy-dev.jsonl", rows)
    ws.registry.register("toy-dev", path, "dev")
    return rows
