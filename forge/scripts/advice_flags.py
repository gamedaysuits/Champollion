#!/usr/bin/env python3
"""Every ``nmt-forge <command> … --flag`` forge's own text names, as JSON.

forge's refusals, advice and next commands name CLI flags; an agent driving
forge over MCP can only apply that advice if the tool for that command takes
the flag (Round 9: forge advised ``prereg new … --config-hash`` and the MCP
``forge_prereg`` tool had no such argument). The MCP server's test suite runs
this script and checks every flag against the tool schemas.

Reads the string literals of ``nmt_forge/**/*.py`` with :mod:`ast` (so
implicitly concatenated literals and f-strings are read whole — a grep of the
source would miss a flag split across two lines). A command's fragment ends
at a backtick, a quote, a parenthesis, ``;``, ``&&``, ``|``, a comma, a
dash-separated clause (`` — ``) or the next ``nmt-forge``. Content-free: prints command
names and flags only.

    python3 scripts/advice_flags.py            # {"<command>": {"--flag": ["file:line", …]}}
"""

from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1] / "nmt_forge"

#: ``nmt-forge`` then a command and an optional sub-command (lowercase words)
_CMD = re.compile(r"(?<![\w-])nmt-forge\s+([a-z][a-z-]*)(?:\s+([a-z][a-z-]*))?")
_STOP = re.compile(r"`|\"|'|\(|\)|;|&&|\||,\s|\s—\s|\snmt-forge\s|\n")
_FLAG = re.compile(r"(?<![\w-])(--[a-z][a-z-]*)")
#: two-word commands (the sub-command is part of the name)
_TWO = {"registry", "prereg", "ledger"}
#: placeholder for a formatted value inside an f-string
_HOLE = "<…>"


def advice_flags(pkg: Path = PKG) -> dict[str, dict[str, list[str]]]:
    out: dict[str, dict[str, list[str]]] = {}
    for py in sorted(pkg.rglob("*.py")):
        tree = ast.parse(py.read_text(encoding="utf-8"), filename=str(py))
        # an f-string's literal parts are also Constant nodes inside it:
        # read each JoinedStr whole and skip its parts
        inner = {id(v) for n in ast.walk(tree) if isinstance(n, ast.JoinedStr)
                 for v in n.values}
        for node in ast.walk(tree):
            if id(node) in inner:
                continue
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                text, line = node.value, node.lineno
            elif isinstance(node, ast.JoinedStr):
                text = "".join(v.value if isinstance(v, ast.Constant)
                               and isinstance(v.value, str) else _HOLE
                               for v in node.values)
                line = node.lineno
            else:
                continue
            for m in _CMD.finditer(text):
                cmd = m.group(1)
                if cmd in _TWO and m.group(2):
                    cmd = f"{cmd} {m.group(2)}"
                rest = text[m.end():]
                stop = _STOP.search(rest)
                frag = rest[:stop.start()] if stop else rest
                where = f"{py.relative_to(pkg.parent)}:{line}"
                for flag in _FLAG.findall(frag):
                    out.setdefault(cmd, {}).setdefault(flag, []).append(where)
    return out


if __name__ == "__main__":
    json.dump(advice_flags(), sys.stdout, indent=1, sort_keys=True)
    sys.stdout.write("\n")
