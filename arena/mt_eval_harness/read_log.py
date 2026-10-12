"""
Test-set read log — the harness's half of nmt-forge's one-shot accounting.

nmt-forge counts how many times a workspace's TEST (or sealed) set has been
read, so a model is not tuned against its own test set by re-scoring it. Reads
made through the harness — ``mt-eval run`` on that corpus file — happened
outside forge and were never counted (synthetic researcher, Round 7).

The log is OPT-IN by the file's registrant. When nmt-forge registers a corpus
file as a test/sealed set it creates ``<file>.reads.jsonl`` beside it (first
line ``{"event": "watch", "tool": "nmt-forge", ...}``) — the same sidecar
convention as the steward's ``<file>.champollion.json``. The harness appends
one line per read ONLY when that log already exists; for every other file it
writes nothing, so a user's folders are never littered.

A read record is content-free — what was read, by which command, when, and
the file's sha256 at read time; never a sentence, a score, or another path::

    {"event": "read", "tool": "mt-eval", "tool_version": "0.2.0",
     "command": "run", "purpose": "benchmark", "run_id": "run_…",
     "sha256": "<64 hex>", "ts": "2026-10-04T12:00:00+00:00"}

Recording never fails a run: an append that raises OSError prints one warning
line to stderr and returns ``{"error": ...}``.
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

#: The sidecar suffix: ``<corpus file>.reads.jsonl``.
READ_LOG_SUFFIX = ".reads.jsonl"


def read_log_path(corpus_path) -> Path:
    """Where the read log of ``corpus_path`` lives (whether or not it exists)."""
    return Path(str(corpus_path) + READ_LOG_SUFFIX)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def record_read(corpus_path, *, command: str, purpose: str,
                run_id: str) -> dict | None:
    """Append one read record to ``<corpus_path>.reads.jsonl`` — only if that
    log already exists (its registrant, nmt-forge, created it).

    Returns the record appended, ``None`` when the file has no read log (and
    nothing was written), or ``{"error": ...}`` when the append failed — a
    failure is one warning line on stderr, never an exception: recording a
    read must not fail the run that made it.
    """
    log = read_log_path(corpus_path)
    if not log.is_file():
        return None
    from mt_eval_harness import __version__
    try:
        record = {
            "event": "read",
            "tool": "mt-eval",
            "tool_version": __version__,
            "command": command,
            "purpose": purpose,
            "run_id": str(run_id),
            "sha256": _sha256_file(Path(corpus_path)),
            "ts": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        }
        line = json.dumps(record, ensure_ascii=False) + "\n"
        with open(log, "a+b") as fh:
            # The registrant's last line may lack its newline: never glue
            # this record onto it.
            fh.seek(0, 2)
            if fh.tell() > 0:
                fh.seek(-1, 2)
                if fh.read(1) != b"\n":
                    line = "\n" + line
            fh.write(line.encode("utf-8"))
    except OSError as exc:
        print(f"  ⚠ test-set read NOT recorded in {log}: {exc} "
              f"(the run itself is unaffected)", file=sys.stderr)
        return {"error": f"{type(exc).__name__}: {exc}"}
    return record


def read_recorded_line(corpus_path) -> str:
    """The one sentence a run prints when it appended a read record."""
    return (f"  Test-set read recorded in {read_log_path(corpus_path)} "
            f"(nmt-forge counts it)")
