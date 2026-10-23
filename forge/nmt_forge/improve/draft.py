"""Drafts from the newer model, for a blind two-model review sheet.

When a round's new model is not put to use (the dev set saw no measurable
gain), the speaker's marks kept measuring only the model in use — the newer
one was never seen by the person whose judgement matters most
(FORGE_MACHINE_CRITIQUE finding 2). The review sheet now gives some rows to
the newer model, assigned at random and not marked as such: the speaker
judges both on the family's own new sentences, blind. This module drafts
those rows; `champollion improve sheet` assigns them and keeps the key.

After a promotion there is no newer model, and the rows go to the model the
promoted one REPLACED: the speaker then judges the new model against its
predecessor on the same visit, so a change in how leniently they mark
cancels out (stress test 12, 2026-10-13 — a promotion the practice set got
wrong by chance, plus a speaker marking more kindly each round, read as
"Real progress" in 6.6% of reports when the model could not improve).

Content stays in the project folder: the drafts are written to the file
named, never printed; the ledger gets counts only.
"""

from __future__ import annotations

import json
from pathlib import Path

from ..training.run import decode_with_run
from ..workspace import Workspace
from .compare import _manifest
from .wishlist import newest_run

DRAFT_NEWER = "draft-newer"


def _in_use(ws: Workspace) -> tuple[dict, list[dict], dict | None]:
    """(snapshot, servable exports, the export in use or None)."""
    from ..advisor import _in_use_export, snapshot

    s = snapshot(ws)
    servable = [e for e in s.get("exports", []) if e.get("dir") and e.get("model_included", True)]
    return s, servable, _in_use_export(s, servable)


def newer_than_in_use(ws: Workspace) -> tuple[dict | None, dict | None]:
    """(in-use run manifest, newer run manifest) when the newest trained run
    is not the one in use; (in_use, None) otherwise."""
    _s, _servable, use = _in_use(ws)
    if not use or not use.get("manifest"):
        return None, None
    try:
        newest = newest_run(ws)
    except Exception:
        return _manifest(use["manifest"]), None
    if Path(newest).resolve() == Path(use["manifest"]).resolve():
        return _manifest(use["manifest"]), None
    return _manifest(use["manifest"]), _manifest(newest)


def replaced_by_in_use(ws: Workspace) -> dict | None:
    """The run manifest of the model in use before the one in use now — the
    model a promotion replaced — or None. Read from the people's recorded
    choices, then from what was served, newest first; a re-export of the same
    run is the same model, not a predecessor."""
    s, servable, use = _in_use(ws)
    if not use or not use.get("manifest"):
        return None

    def key(d):
        return str(Path(d).resolve())

    by = {key(x.get("model_dir") or x["dir"]): x for x in servable}
    here = key(use.get("model_dir") or use["dir"])
    run_now = Path(use["manifest"]).resolve()
    for d in [*reversed(s.get("chosen") or []), *reversed(s.get("served") or [])]:
        x = by.get(key(d))
        if x is None or key(d) == here or not x.get("manifest"):
            continue
        if Path(x["manifest"]).resolve() == run_now:
            continue
        try:
            return _manifest(x["manifest"])
        except Exception:
            continue
    return None


def other_than_in_use(ws: Workspace) -> tuple[dict | None, dict | None, str | None]:
    """(in use, the other model, how they relate): "newer" — the newest
    trained run, not put to use; else "replaced" — the model the one in use
    replaced; else (in use, None, None)."""
    use, newer = newer_than_in_use(ws)
    if use is None:
        return None, None, None
    if newer is not None:
        return use, newer, "newer"
    prev = replaced_by_in_use(ws)
    return use, prev, ("replaced" if prev is not None else None)


def training_pairs(manifest: dict | None) -> int | None:
    """How many of the family's own sentence pairs a run trained on (the mix's
    gold rows, the largest of its stages), or None when the manifest does not
    say."""
    rows = [((st.get("mix") or {}).get("gold") or {}).get("rows")
            for st in (manifest or {}).get("stages") or []]
    rows = [r for r in rows if isinstance(r, int) and not isinstance(r, bool)]
    return max(rows) if rows else None


def draft_newer(ws: Workspace, lines_file: str | Path, out_file: str | Path) -> dict:
    """Decode the lines with the other model — the newer run, or the one the
    model in use replaced — into out_file ({"row": i, "draft": …} per line);
    returns counts, the run names, how they relate and their training pairs."""
    use, other, relation = other_than_in_use(ws)
    rec = {"other": (other or {}).get("run_name"), "relation": relation,
           "newer": (other or {}).get("run_name") if relation == "newer" else None,
           "in_use": (use or {}).get("run_name"),
           "in_use_pairs": training_pairs(use), "other_pairs": training_pairs(other), "n": 0}
    if other is None:
        return rec
    lines = [ln.rstrip("\n") for ln in Path(lines_file).read_text(encoding="utf-8").splitlines()]
    hyps = decode_with_run(other, lines) if lines else []
    with Path(out_file).open("w", encoding="utf-8") as fh:
        for i, h in enumerate(hyps):
            fh.write(json.dumps({"row": i, "draft": h}, ensure_ascii=False) + "\n")
    rec["n"] = len(hyps)
    ws.ledger.append(DRAFT_NEWER, **rec)
    return rec
