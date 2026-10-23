"""The generated mt-eval command reference is current and complete.

cli/website/docs/reference/mt-eval.md is DERIVED from
mt_eval_harness.cli.build_parser() by arena/scripts/gen_command_reference.py.
A parser change without a regenerated page is drift: `--check` exits 3 and
this test fails, naming the command that fixes it.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ARENA = Path(__file__).resolve().parents[1]
REPO = ARENA.parent
SCRIPT = ARENA / "scripts" / "gen_command_reference.py"
PAGE = REPO / "cli" / "website" / "docs" / "reference" / "mt-eval.md"


def _run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPT), *args],
                          capture_output=True, text=True, timeout=120)


def test_committed_page_is_current():
    r = _run("--check")
    assert r.returncode == 0, (
        f"mt-eval reference is stale (exit {r.returncode}): {r.stderr.strip()}\n"
        "Regenerate: python3 arena/scripts/gen_command_reference.py")


def test_check_exits_3_on_a_stale_page(tmp_path):
    stale = tmp_path / "mt-eval.md"
    stale.write_text(PAGE.read_text(encoding="utf-8") + "\nhand edit\n",
                     encoding="utf-8")
    r = _run("--check", "--out", str(stale))
    assert r.returncode == 3, r.stderr
    missing = tmp_path / "absent.md"
    assert _run("--check", "--out", str(missing)).returncode == 3


def test_known_subcommands_appear():
    text = PAGE.read_text(encoding="utf-8")
    assert "slug: /reference/mt-eval" in text
    assert "title: mt-eval command reference" in text
    for heading in ("## `mt-eval translate`", "## `mt-eval serve`",
                    "## `mt-eval run`", "## `mt-eval project`",
                    "### `mt-eval project register`",
                    "### `mt-eval project offer`",
                    "#### `mt-eval node ceremony init`"):
        assert heading in text, heading


def test_every_subcommand_at_every_depth_has_a_heading():
    sys.path.insert(0, str(ARENA))
    from mt_eval_harness.cli import build_parser

    text = PAGE.read_text(encoding="utf-8")
    missing = []

    def walk(path, parser):
        for action in parser._actions:
            if isinstance(action, argparse._SubParsersAction):
                for name, sub in action.choices.items():
                    full = f"{path} {name}"
                    if f"`{full}`\n" not in text:
                        missing.append(full)
                    walk(full, sub)

    walk("mt-eval", build_parser())
    assert not missing, missing


def test_global_flags_listed_once_not_per_command():
    text = PAGE.read_text(encoding="utf-8")
    # _share_global_flags copies --non-interactive onto every subparser; the
    # page lists it once, in Global flags.
    assert text.count("| `--non-interactive` |") == 1
