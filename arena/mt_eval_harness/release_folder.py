"""release_folder — the folder `mt-eval contest prepare` labels releasable.

``contest prepare`` writes everything an organizer may RELEASE into
``<out>/public/`` and everything that never leaves the machine into
``<out>/local/``. A run on the released dev set (the baseline the docs
suggest for setting the qualifier threshold) used to write its run logs and
translation cache into ``public/results/`` — so an organizer who then shipped
``public/`` shipped run logs and cache copies too (synthetic researcher,
Round 13).

The rule, shared with the MCP server (mcp-server ``releasableRoot``):

* prepare drops :data:`MARKER` into ``public/``;
* a path is inside a releasable folder when that folder — the path itself or
  any ancestor — holds :data:`MARKER`, or (for contests prepared before the
  marker existed) is a directory named ``public`` beside ``local/manifest.json``;
* run logs, reports and caches are never written inside one: ``mt-eval run``
  refuses such an ``--output-dir`` / ``--cache-dir`` and names
  :func:`runs_dir_for` instead; the MCP server defaults there on its own.

Stdlib only.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

#: The marker file prepare writes into the releasable folder.
MARKER = ".champollion-releasable.json"


def write_marker(public_dir, *, contest_id: str, written_by: str =
                 "mt-eval contest prepare") -> Path:
    """Write :data:`MARKER` into ``public_dir`` and return its path."""
    path = Path(public_dir) / MARKER
    path.write_text(json.dumps({
        "releasable": True,
        "written_by": written_by,
        "contest": contest_id,
        "note": ("Everything in this folder may be released. Run logs, "
                 "reports and translation caches are never written here: "
                 "mt-eval and the MCP server put them in the 'runs' folder "
                 "beside it."),
    }, indent=2) + "\n", encoding="utf-8")
    return path


def releasable_root(path) -> Optional[Path]:
    """The releasable folder ``path`` is in (or is), or None.

    ``path`` need not exist (an output directory about to be created): the
    walk starts at its nearest existing ancestor. A file's folder is its
    parent. When releasable folders are nested, the OUTERMOST is returned,
    so :func:`runs_dir_for` names a folder outside all of them (the MCP
    server's ``releasableRoot`` makes the same choice)."""
    if path is None or str(path).strip() == "":
        return None
    p = Path(str(path)).expanduser()
    try:
        p = p.resolve()
    except OSError:
        p = p.absolute()
    probe = p
    while not probe.exists() and probe != probe.parent:
        probe = probe.parent
    if probe.is_file():
        probe = probe.parent
    found = None
    for d in (probe, *probe.parents):
        if (d / MARKER).is_file() or (
                d.name == "public"
                and (d.parent / "local" / "manifest.json").is_file()):
            found = d
    return found


def runs_dir_for(root: Path) -> Path:
    """Where run logs and caches go for a releasable folder: ``runs/`` beside
    it (``<contest>/runs/``) — never inside it."""
    return Path(root).parent / "runs"


def refusal(path, *, flag: str) -> Optional[str]:
    """The message refusing ``path`` (given as ``flag``) because it is inside
    a releasable folder, or None when it is not."""
    root = releasable_root(path)
    if root is None:
        return None
    return (f"{flag} {path} is inside {root}, the folder `mt-eval contest "
            f"prepare` marked releasable (everything there may be shipped "
            f"to entrants). Run logs, reports and translation caches never "
            f"go there — pass {flag} {runs_dir_for(root)} (or any folder "
            f"outside it).")
