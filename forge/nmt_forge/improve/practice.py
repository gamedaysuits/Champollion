"""Growing the dev set from the speaker's practice sentences.

A round's verdict is only as good as its dev set: at 23 sentences only a
difference of about 7 chrF++ points shows reliably, and a round of new
sentences usually adds less (docs/FORGE_MACHINE_CRITIQUE_2026-10-12.md,
finding 1). So some rows of each review sheet carry no draft — the speaker
writes how the sentence is said — and those rows join the dev set here. They
are never trained on: the dev fence keeps dev rows out of every training file.

The dev set keeps its name and is re-registered with its new content (the
registry records what it replaced); the model in use translates the grown set
again when the next round is judged (``improve.compare``). A practice row whose
source sentence is already in the dev set or in any test or sealed set is left
out, and a practice file is merged once (the ledger records its sha256).
"""

from __future__ import annotations

import json
from pathlib import Path

from ..canonical import canonical_key, sha256_file
from ..errors import ForgeError
from ..privacy import carried_mark, carry_mark, merge_marks
from ..registry import load_rows
from ..workspace import Workspace

DEV_GROWN = "dev-grown"


def merged_files(ws: Workspace, set_name: str) -> set[str]:
    """sha256 of every practice file already merged into ``set_name``."""
    return {sha for e in ws.ledger.find(DEV_GROWN, set=set_name) for sha in (e.get("files") or {}).values()}


def _next_path(dev_path: Path) -> Path:
    stem = dev_path.stem.split("-grown-")[0]
    k = 1
    while (dev_path.parent / f"{stem}-grown-{k}.jsonl").exists():
        k += 1
    return dev_path.parent / f"{stem}-grown-{k}.jsonl"


def grow_dev(ws: Workspace, set_name: str, files: list[str | Path]) -> dict:
    """Append the practice files' new rows to the registered dev set
    ``set_name``; re-register it with the grown content. Returns counts only
    (and writes a ``dev-grown`` ledger event with them)."""
    entry = ws.registry.get(set_name)
    if entry.get("role") != "dev":
        raise ForgeError(f"{set_name} is a {entry.get('role')} set, not a dev set\n"
                         "  why: practice sentences grow the dev set a round is judged on\n"
                         "  fix: name the project's dev set (config.json data.dev)")
    src_f, tgt_f = entry["source_field"], entry["target_field"]
    dev_path = Path(entry["path"])
    rows = ws.registry.open_eval(set_name, "audit")
    taken = {canonical_key(str(r.get(src_f, ""))) for r in rows}
    held = set()
    for name in ws.registry.names():
        e = ws.registry.get(name)
        if e.get("role") in ("test", "sealed"):
            held |= {canonical_key(str(r.get(e["source_field"], "")))
                     for r in ws.registry.open_eval(name, "audit")}
    already = merged_files(ws, set_name)
    new_rows: list[dict] = []
    used: dict[str, str] = {}
    skipped = {"already_merged": 0, "in_dev": 0, "in_test": 0, "empty": 0}
    marks = [carried_mark(dev_path)]
    for f in files:
        p = Path(f)
        if not p.is_file():
            raise ForgeError(f"{f}: no such practice file\n"
                             "  fix: champollion improve marks writes them (data/dev/practice-round-<k>.tsv)")
        sha = sha256_file(p)
        if sha in already:
            skipped["already_merged"] += 1
            continue
        marks.append(carried_mark(p))
        for r in load_rows(p):
            s, t = str(r.get("source", "")).strip(), str(r.get("target", "")).strip()
            if not s or not t:
                skipped["empty"] += 1
                continue
            k = canonical_key(s)
            if k in held:
                skipped["in_test"] += 1
                continue
            if k in taken:
                skipped["in_dev"] += 1
                continue
            taken.add(k)
            new_rows.append({src_f: s, tgt_f: t})
        used[str(p)] = sha
    event = {"set": set_name, "before": len(rows), "added": len(new_rows), "after": len(rows) + len(new_rows),
             "skipped": skipped, "files": used}
    if not new_rows:
        event["path"] = str(dev_path)
        if used:
            ws.ledger.append(DEV_GROWN, **event)
        return event
    out = _next_path(dev_path)
    body = [json.dumps(r, ensure_ascii=False) for r in rows] + [json.dumps(r, ensure_ascii=False) for r in new_rows]
    out.write_text("\n".join(body) + "\n", encoding="utf-8")
    mark = merge_marks(*marks)
    carry_mark(dev_path, [out], command="grow-dev", mark=mark or None)
    ws.registry.register(set_name, out, "dev", source_field=src_f, target_field=tgt_f, allow_rotate=True)
    event["path"] = str(out)
    ws.ledger.append(DEV_GROWN, **event)
    return event
