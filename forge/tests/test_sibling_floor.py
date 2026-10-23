"""nmt-forge consumes the harness for all scoring and for the framework
documents (method/1 on export). Its ``mt-eval-harness`` floor names the
harness it is built and tested against — the one in this tree — so a release
that bumps the harness (PyPI never republishes a version) moves the floor with
it, and no install pairs forge with an older harness that lacks what it calls.
Skips outside the monorepo."""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
ARENA = ROOT / "arena" / "pyproject.toml"


@pytest.mark.skipif(not ARENA.is_file(), reason="no arena/ beside forge/")
def test_the_harness_floor_is_the_harness_in_this_tree():
    harness = tomllib.loads(ARENA.read_text(encoding="utf-8"))["project"]["version"]
    deps = tomllib.loads((ROOT / "forge" / "pyproject.toml").read_text(encoding="utf-8"))["project"]["dependencies"]
    floors = [m.group(1) for d in deps if (m := re.fullmatch(r"mt-eval-harness>=([\w.]+)", d.replace(" ", "")))]
    assert floors == [harness], (
        f"nmt-forge depends on {[d for d in deps if 'mt-eval-harness' in d]}, but it is built "
        f"against mt-eval-harness {harness} — set \"mt-eval-harness>={harness}\" in forge/pyproject.toml")
