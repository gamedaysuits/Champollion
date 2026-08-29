"""The eval ledger — adaptive use of eval data made visible (guard #9).

The catalogued failure: eval pairs quietly guided development decisions
("what to fix first"), so they were partly spent as a pure test — and nothing
recorded it. The fix is not a policy document; it's a LOG: every read of a
registered eval file goes through the registry, and the registry writes an
append-only, hash-chained ledger event (timestamp, purpose, config hash).
``spend_report`` then answers "how used-up is this set" with data.

The chain (each entry embeds the hash of the previous entry) makes silent
edits and deletions visible: ``verify_chain`` fails on any tampering. This is
tamper-EVIDENT bookkeeping for honest people and their agents, not
cryptographic security.

Events written by the suite:
    register / rotate    — a file became (or replaced) a registered eval set
    read                 — a registered set was loaded (purpose-tagged:
                           score | dev-selection | audit | inspect)
    prereg               — a preregistration was created
    score                — a registered set was scored
    sealed-spend         — a sealed set's one shot was used
    override             — a refusal was explicitly overridden (reason logged)
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from .errors import LedgerError

_GENESIS = "genesis"


def _entry_hash(entry: dict) -> str:
    payload = {k: v for k, v in entry.items() if k != "entry_hash"}
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()[:32]


class Ledger:
    """Append-only JSONL event log with a tamper-evident hash chain."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    # -- writing -------------------------------------------------------------
    def append(self, event: str, **fields) -> dict:
        prev = self._last_hash()
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "event": event,
            **fields,
            "prev": prev,
        }
        entry["entry_hash"] = _entry_hash(entry)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        return entry

    # -- reading -------------------------------------------------------------
    def entries(self) -> list[dict]:
        if not self.path.exists():
            return []
        out = []
        for i, line in enumerate(self.path.read_text(encoding="utf-8").splitlines()):
            if not line.strip():
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise LedgerError(f"{self.path}:{i + 1}: unparseable ledger line ({e})") from e
        return out

    def find(self, event: str | None = None, **match) -> list[dict]:
        """Entries filtered by event name and exact field values."""
        out = []
        for e in self.entries():
            if event is not None and e.get("event") != event:
                continue
            if all(e.get(k) == v for k, v in match.items()):
                out.append(e)
        return out

    def verify_chain(self) -> int:
        """Verify the hash chain end to end; returns entry count.

        Raises LedgerError naming the first broken link — an edited, deleted,
        or reordered entry breaks every hash after it.
        """
        prev = _GENESIS
        entries = self.entries()
        for i, e in enumerate(entries):
            if e.get("prev") != prev:
                raise LedgerError(
                    f"{self.path}: chain broken at entry {i + 1} "
                    f"(prev={e.get('prev')!r}, expected {prev!r}) — "
                    "the ledger was edited or truncated"
                )
            if _entry_hash(e) != e.get("entry_hash"):
                raise LedgerError(
                    f"{self.path}: entry {i + 1} content does not match its hash — "
                    "the entry was edited after being written"
                )
            prev = e["entry_hash"]
        return len(entries)

    def _last_hash(self) -> str:
        entries = self.entries()
        return entries[-1]["entry_hash"] if entries else _GENESIS

    # -- reporting -----------------------------------------------------------
    def spend_report(self, set_name: str) -> dict:
        """How used-up is this eval set? Counts by event/purpose, configs seen."""
        touching = [e for e in self.entries() if e.get("set") == set_name]
        by_purpose: dict[str, int] = {}
        configs: set[str] = set()
        for e in touching:
            if e["event"] == "read":
                p = e.get("purpose", "?")
                by_purpose[p] = by_purpose.get(p, 0) + 1
            if e.get("config_hash"):
                configs.add(e["config_hash"])
        return {
            "set": set_name,
            "events": len(touching),
            "reads_by_purpose": by_purpose,
            "score_events": sum(1 for e in touching if e["event"] == "score"),
            "sealed_spends": sum(1 for e in touching if e["event"] == "sealed-spend"),
            "overrides": sum(1 for e in touching if e["event"] == "override"),
            "distinct_configs": sorted(configs),
            "first": touching[0]["ts"] if touching else None,
            "last": touching[-1]["ts"] if touching else None,
        }

    def sealed_spent(self, set_name: str) -> bool:
        return bool(self.find("sealed-spend", set=set_name))
