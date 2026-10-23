"""The people's RunPod key: from the environment, else ``.env.local``, else
``.env`` (searched upward from the given folders), the same order the
harness and the CLI use for model-API keys. The key is never printed,
logged, written to a job file or put on a command line: callers get it as a
:class:`Secret`, whose ``repr`` and ``str`` say only where it came from.
"""

from __future__ import annotations

import os
from pathlib import Path

VAR = "RUNPOD_API_KEY"
FILES = (".env.local", ".env")


class Secret:
    """A key and where it was found; prints as ``<RUNPOD_API_KEY from …>``."""

    __slots__ = ("_value", "where")

    def __init__(self, value: str, where: str):
        self._value = value
        self.where = where

    def reveal(self) -> str:
        """The key itself — for the Authorization header, nothing else."""
        return self._value

    def __repr__(self) -> str:
        return f"<{VAR} from {self.where}>"

    __str__ = __repr__


def _from_file(path: Path) -> str | None:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None
    for line in lines:
        s = line.strip()
        if s.startswith("export "):
            s = s[len("export "):].strip()
        if not s.startswith(VAR):
            continue
        name, _, value = s.partition("=")
        if name.strip() != VAR:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        return value or None
    return None


def find_key(*start_dirs) -> Secret | None:
    """The key, or None. Never raises on an unreadable file (it is skipped)."""
    if os.environ.get(VAR):
        return Secret(os.environ[VAR].strip(), f"the environment ({VAR})")
    seen = set()
    for start in [*start_dirs, Path.cwd()]:
        d = Path(start).expanduser().resolve()
        for folder in [d, *d.parents]:
            for name in FILES:
                p = folder / name
                if p in seen or not p.is_file():
                    continue
                seen.add(p)
                value = _from_file(p)
                if value:
                    return Secret(value, str(p))
    return None


def require_key(*start_dirs) -> Secret:
    from ..errors import RemoteComputeRefused

    key = find_key(*start_dirs)
    if key is None:
        raise RemoteComputeRefused(
            f"no RunPod key: {VAR} is not in the environment, .env.local or .env",
            why="remote training rents a machine on the people's own RunPod account; forge never holds a key "
                "of its own",
            fix=f"the account holder adds a line {VAR}=… to .env.local in the project folder (never paste the "
                "key into a chat with an AI agent), then runs: nmt-forge remote doctor")
    return key
