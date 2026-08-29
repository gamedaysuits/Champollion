"""Eval registry — the single answer to "which files are eval sets?"

Nearly every guard needs that fact: split-guard records what it carved,
dev-fence refuses checkpoint selection on anything registered as test,
leak-audit screens corpora against every registered set, the ledger logs
reads, preregistration binds predictions to a set's content hash.

Registration pins the file's sha256. Every later access re-hashes and refuses
on mismatch — silent eval-set drift (a file "fixed up" after results exist)
becomes a hard error instead of an invisible re-benchmark.

Roles:
    dev     — iteration data; drives checkpoint selection; read freely.
    test    — measured sparingly; scoring requires a preregistration.
    sealed  — one-shot final test; scoring spends it, a second spend refuses.

Founder ruling 2026-07-12: test sets are REAL DATA ONLY — registering a file
as ``test``/``sealed`` refuses rows that carry synthetic provenance (engine
provenance stamps, source-side lane tags like ``<synth>``).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from .canonical import canonical_key, detect_target_field, sha256_file
from .errors import RegistryError, SealedSetSpent
from .ledger import Ledger

ROLES = ("dev", "test", "sealed")
READ_PURPOSES = ("score", "dev-selection", "audit", "inspect")

# source-side lane tags look like "<synth> ..." / "<bt> ..." — synthetic rows
_TAG_RE = re.compile(r"^<[a-z0-9_-]+>\s")


def load_rows(path: str | Path) -> list[dict]:
    """Load eval/corpus rows from .jsonl, or .json (list / {"entries": [...]}).

    Every row must be an object; anything else fails loud — a half-parsed
    eval file must never silently score as empty.
    """
    path = Path(path)
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".jsonl":
        rows = [json.loads(line) for line in text.splitlines() if line.strip()]
    else:
        data = json.loads(text)
        if isinstance(data, dict) and isinstance(data.get("entries"), list):
            rows = data["entries"]
        elif isinstance(data, list):
            rows = data
        else:
            raise RegistryError(
                f"{path}: expected a JSON list, {{'entries': [...]}} object, or .jsonl"
            )
    if not rows:
        raise RegistryError(f"{path}: no rows — refusing to register/score an empty set")
    bad = [i for i, r in enumerate(rows) if not isinstance(r, dict)]
    if bad:
        raise RegistryError(f"{path}: rows {bad[:5]} are not objects")
    return rows


def _looks_synthetic(row: dict) -> str | None:
    """Return the synthetic marker found on a row, or None."""
    if row.get("synthetic") is True:
        return "synthetic: true"
    prov = str(row.get("provenance", ""))
    if "champollion-derived" in prov:
        return f"provenance: {prov[:60]}"
    src = row.get("source", "")
    if isinstance(src, str) and _TAG_RE.match(src):
        return f"tagged source: {src.split(maxsplit=1)[0]}"
    return None


class EvalRegistry:
    """Registered eval sets, persisted as content-free JSON (paths + hashes)."""

    def __init__(self, path: str | Path, ledger: Ledger):
        self.path = Path(path)
        self.ledger = ledger
        self.path.parent.mkdir(parents=True, exist_ok=True)

    # -- persistence ----------------------------------------------------------
    def _read(self) -> dict:
        if not self.path.exists():
            return {"version": 1, "sets": {}}
        return json.loads(self.path.read_text(encoding="utf-8"))

    def _write(self, data: dict) -> None:
        self.path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    # -- registration ---------------------------------------------------------
    def register(
        self,
        name: str,
        file_path: str | Path,
        role: str,
        *,
        source_field: str = "source",
        target_field: str | None = None,
        note: str = "",
        allow_rotate: bool = False,
    ) -> dict:
        if role not in ROLES:
            raise RegistryError(f"role must be one of {ROLES}, got {role!r}")
        file_path = Path(file_path).resolve()
        rows = load_rows(file_path)
        if target_field is None:
            target_field = detect_target_field(rows)

        if role in ("test", "sealed"):
            marks = [(i, m) for i, r in enumerate(rows) if (m := _looks_synthetic(r))]
            if marks:
                i, m = marks[0]
                raise RegistryError(
                    f"refusing to register {file_path.name} as {role!r}: "
                    f"{len(marks)} rows carry synthetic provenance (row {i}: {m}). "
                    "Test sets are REAL DATA ONLY (founder ruling 2026-07-12) — "
                    "synthetic variants belong in training, built from TRAIN-side "
                    "sentences."
                )

        sha = sha256_file(file_path)
        data = self._read()
        existing = data["sets"].get(name)
        if existing and existing["sha256"] == sha and existing["role"] == role:
            return existing  # idempotent re-register
        if existing and not allow_rotate:
            raise RegistryError(
                f"eval set {name!r} is already registered with different "
                f"content/role (sha {existing['sha256'][:12]}… vs {sha[:12]}…). "
                "Replacing a registered eval set is a deliberate act: pass "
                "allow_rotate=True and the rotation will be ledgered."
            )
        entry = {
            "path": str(file_path),
            "sha256": sha,
            "role": role,
            "rows": len(rows),
            "source_field": source_field,
            "target_field": target_field,
            "note": note,
            "created_utc": None,  # set below via ledger ts for one clock
        }
        event = self.ledger.append(
            "rotate" if existing else "register",
            set=name, role=role, sha256=sha, rows=len(rows), path=str(file_path),
        )
        entry["created_utc"] = event["ts"]
        data["sets"][name] = entry
        self._write(data)
        return entry

    # -- lookup ---------------------------------------------------------------
    def get(self, name: str) -> dict:
        data = self._read()
        if name not in data["sets"]:
            known = ", ".join(sorted(data["sets"])) or "(none registered)"
            raise RegistryError(f"no eval set named {name!r}; registered: {known}")
        return data["sets"][name]

    def names(self, roles: tuple[str, ...] | None = None) -> list[str]:
        data = self._read()
        return sorted(
            n for n, e in data["sets"].items() if roles is None or e["role"] in roles
        )

    def entry_for_file(self, file_path: str | Path) -> tuple[str, dict] | None:
        """Find a registered set by absolute path or by content sha."""
        file_path = Path(file_path).resolve()
        sha = sha256_file(file_path) if file_path.exists() else None
        for name, e in self._read()["sets"].items():
            if e["path"] == str(file_path) or (sha and e["sha256"] == sha):
                return name, e
        return None

    # -- the audited access path ------------------------------------------------
    def open_eval(
        self,
        name: str,
        purpose: str,
        *,
        config_hash: str | None = None,
        override_respend: str | None = None,
    ) -> list[dict]:
        """Load a registered set's rows: sha-verified, ledgered, spend-gated.

        This is the ONLY sanctioned way suite code reads a registered eval
        file — that is what makes adaptive use visible (guard #9).
        """
        if purpose not in READ_PURPOSES:
            raise RegistryError(f"purpose must be one of {READ_PURPOSES}, got {purpose!r}")
        entry = self.get(name)
        path = Path(entry["path"])
        if not path.exists():
            raise RegistryError(f"registered eval set {name!r} missing on disk: {path}")
        sha = sha256_file(path)
        if sha != entry["sha256"]:
            raise RegistryError(
                f"content of {name!r} changed since registration "
                f"({entry['sha256'][:12]}… → {sha[:12]}…). An eval set that "
                "drifts under existing results corrupts every comparison. "
                "If the change is deliberate, re-register with allow_rotate=True "
                "under a new name or an explicit rotation."
            )
        if entry["role"] == "sealed" and purpose == "score":
            if self.ledger.sealed_spent(name) and not override_respend:
                raise SealedSetSpent(
                    f"sealed set {name!r} has already been spent",
                    why="a sealed set answers one question once; re-scoring it "
                        "turns the final exam into a dev set",
                    fix="evaluate on a dev/test-role set instead; if you truly "
                        "must re-spend, pass override_respend='<reason>' — the "
                        "override is ledgered and visible forever",
                )
            if self.ledger.sealed_spent(name) and override_respend:
                self.ledger.append(
                    "override", set=name, kind="sealed-respend", reason=override_respend,
                )
        self.ledger.append(
            "read", set=name, role=entry["role"], purpose=purpose,
            config_hash=config_hash, sha256=sha,
        )
        return load_rows(path)

    # -- derived views ----------------------------------------------------------
    def key_sets(
        self, roles: tuple[str, ...] = ("test", "sealed"), canonicalizer=None
    ) -> dict[str, dict]:
        """Canonical source/target key sets per registered set (loaded live).

        Returns ``{name: {"source": set, "target": set, "role": str}}``.
        Used by dev-fence content checks and leak-audit. These reads are the
        machinery's own audit, not a score — ledgered as purpose ``audit``,
        never spend-gated.
        """
        out: dict[str, dict] = {}
        for name in self.names(roles):
            entry = self.get(name)
            rows = self.open_eval(name, "audit")
            src_f, tgt_f = entry["source_field"], entry["target_field"]
            out[name] = {
                "source": {canonical_key(str(r.get(src_f, "")), canonicalizer) for r in rows},
                "target": {canonical_key(str(r.get(tgt_f, "")), canonicalizer) for r in rows},
                "role": entry["role"],
            }
        return out
