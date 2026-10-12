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
from .errors import RotationRefused, RegistryError, SealedSetSpent
from .ledger import Ledger

ROLES = ("dev", "test", "sealed")
READ_PURPOSES = ("score", "dev-selection", "audit", "inspect")

#: The read log beside a registered test/sealed file (``<file>.reads.jsonl``,
#: the steward sidecar's naming): forge creates it with a ``watch`` line when
#: it registers the file, and ``mt-eval run`` / ``compare`` — which never see
#: forge's ledger — append one content-free ``read`` line (run id, purpose,
#: the file's sha256, a timestamp) each time they score it. forge counts
#: those reads: a test set the harness already scored is not unread
#: (Round 7). The harness side: ``mt_eval_harness.read_log``.
READ_LOG_SUFFIX = ".reads.jsonl"

#: The roles whose reads are accounted for (dev is read freely).
WATCHED_ROLES = ("test", "sealed")


def read_log_path(file_path: str | Path) -> Path:
    return Path(str(file_path) + READ_LOG_SUFFIX)


#: The read log starts when forge registers the file, so a benchmark run made
#: BEFORE registration is never in it (Round 8 hospital persona: a baseline
#: scored before `registry add` went uncounted while a later coached run
#: blocked the second preregistration — and nothing said why).
REGISTER_FIRST_NOTE = (
    "register a test set with forge BEFORE any benchmark run on it (mt-eval "
    "run, the MCP run_benchmark): its read log starts at registration, so "
    "only reads after it are counted")

#: Where mt-eval writes a RunLog when nothing else is said, relative to a
#: directory: ``mt-eval run``'s default ``--output-dir`` (relative to where it
#: ran) and the MCP server's ``results/<job>/`` folder beside the corpus file.
#: A RunLog records the scored file's sha256 (``provenance.corpus_sha256``),
#: so registration can find runs of the exact content made before it.
HARNESS_RUNLOG_DIRS = ("eval/logs/harness", "results")
#: Directory levels searched above the test file, the project and the
#: working directory (0 = the directory itself); never above the home dir.
EARLIER_RUN_ASCENT = 2
#: Bounds on what registration reads, so it never crawls a disk: RunLog
#: files examined, and the size of one (a test set's RunLog is a few MB).
EARLIER_RUN_MAX_FILES = 2000
EARLIER_RUN_MAX_BYTES = 256 * 1024 * 1024
#: A RunLog is named ``<run_id>.json``: ``run_…`` (``mt-eval run``) or
#: ``hypsub_…`` (scored hypotheses); its report is ``<run_id>_report.json``.
_RUNLOG_NAME = re.compile(r"^(run|hypsub)_.+(?<!_report)\.json$")


def _runlog_search_dirs(roots) -> list[Path]:
    home = Path.home().resolve()
    out: list[Path] = []
    for root in roots:
        try:
            d = Path(root).resolve()
        except (OSError, ValueError):
            continue
        for _ in range(EARLIER_RUN_ASCENT + 1):
            if d.parent == d:            # never the filesystem root itself
                break
            for sub in HARNESS_RUNLOG_DIRS:
                cand = d / sub
                if cand not in out and cand.is_dir():
                    out.append(cand)
            if d == home:
                break
            d = d.parent
    return out


def earlier_harness_runs(sha256: str, *, roots, counted=()) -> dict:
    """mt-eval RunLogs of THIS content (``provenance.corpus_sha256`` ==
    ``sha256``) found where the harness writes them by default
    (:data:`HARNESS_RUNLOG_DIRS`, in and up to :data:`EARLIER_RUN_ASCENT`
    levels above each of ``roots``), minus the run ids in ``counted`` (reads
    the read log already holds). Content-free: ``{runs: [{run_id, ts,
    log}], searched: [dirs], capped, too_large}`` — ``capped`` when the file
    bound stopped the search, ``too_large`` the RunLogs skipped for size.
    A RunLog holds the scored sentences;
    only its run id, start time and corpus hash are read out of it, and a
    file that does not even contain the hash is never parsed. Runs written
    to another ``--output-dir`` cannot be seen — the caller says so."""
    dirs = _runlog_search_dirs(roots)
    needle = sha256.encode("ascii")
    skip = set(counted)
    runs: dict[str, dict] = {}
    seen = 0
    capped = False
    too_large: list[str] = []
    for d in dirs:
        files = sorted(f for f in set(d.glob("*.json")) | set(d.glob("*/*.json"))
                       if _RUNLOG_NAME.match(f.name)
                       and not f.name.endswith(".champollion.json"))
        for f in files:
            if seen >= EARLIER_RUN_MAX_FILES:
                capped = True
                break
            seen += 1
            try:
                if f.stat().st_size > EARLIER_RUN_MAX_BYTES:
                    too_large.append(str(f))
                    continue
                data = f.read_bytes()
            except OSError:
                continue
            if needle not in data:
                continue
            try:
                doc = json.loads(data)
            except (ValueError, UnicodeDecodeError):
                continue
            if not isinstance(doc, dict) or not doc.get("run_id"):
                continue
            prov = doc.get("provenance") or {}
            if not isinstance(prov, dict) or prov.get(
                    "corpus_sha256") != sha256:
                continue
            rid = str(doc["run_id"])
            if rid in skip or rid in runs:
                continue
            runs[rid] = {"run_id": rid,
                         "ts": doc.get("timestamp_start"),
                         "log": str(f)}
        if capped:
            break
    return {"runs": sorted(runs.values(),
                           key=lambda r: (str(r["ts"] or ""), r["run_id"])),
            "searched": [str(d) for d in dirs], "capped": capped,
            "too_large": too_large}

# source-side lane tags look like "<synth> ..." / "<bt> ..." — synthetic rows
_TAG_RE = re.compile(r"^<[a-z0-9_-]+>\s")


def load_rows(path: str | Path) -> list[dict]:
    """Load eval/corpus rows from .jsonl, .json (list / {"entries": [...]}),
    or .tsv / .tab (source<TAB>target, read by the harness's own TSV rules:
    '# ' comments, an optional header with a "source" column, and a row
    without a target refused by line number).

    A TSV's second column is the row's ``target`` — the same file a teacher
    hands ``mt-eval run --corpus`` works here unchanged.

    Every row must be an object; anything else fails loud — a half-parsed
    eval file must never silently score as empty.
    """
    path = Path(path)
    if path.suffix in (".tsv", ".tab"):
        from . import _harness
        try:
            rows = _harness.corpus_loader_mod().load_tsv(path)
        except ValueError as exc:
            raise RegistryError(str(exc)) from exc
        for r in rows:
            if "target" not in r and "reference" in r:
                r["target"] = r.pop("reference")
        if not rows:
            raise RegistryError(f"{path}: no rows — refusing to register/score an empty set")
        return rows
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


#: ``dataset_id_source`` when nothing names the file but forge's registry
FORGE_NAME_SOURCE = "forge set name"


def dataset_identity(name: str, entry: dict, *, strict: bool = True) -> dict:
    """The dataset id a registered eval set goes by, with forge's own set
    name kept beside it: ``{"set", "dataset_id", "dataset_id_source",
    "corpus_card", "note"}``.

    WHY: one teacher-checked file was 'eval-eng-crk-our-school-dev-v1' on
    its corpora card and in every ``mt-eval`` run, but 'project-test' in
    forge's report and export — two names for one set, so a forge result and
    a harness result on it were not visibly about the same data (synthetic
    school persona, Round 2, 2026-10-03).

    Precedence is the harness's own (``corpus_loader.load_corpus`` +
    ``merge_steward_sidecar``), and every id is read verbatim, never
    derived: the mt-eval registry id ``add-harness`` materialized → a JSON
    envelope's own ``dataset.id`` → the registered card's ``id`` (only while
    the file's sha256 matches the one recorded at registration) → the
    steward sidecar's ``id`` → forge's set name. ``set`` (forge's name) is
    what the ledger, preregistrations and ``--eval-set`` keep using.

    ``strict=False`` turns an unreadable sidecar/envelope into a ``note``
    (listings); otherwise it raises RegistryError.
    """
    from . import _harness

    out = {"set": name, "dataset_id": name,
           "dataset_id_source": FORGE_NAME_SOURCE, "corpus_card": None,
           "note": None}
    if entry.get("dataset_id"):
        out.update(dataset_id=entry["dataset_id"],
                   dataset_id_source=entry.get("dataset_id_source")
                   or "given at registration")
        return out
    try:
        terms = _harness.corpus_terms(entry["path"])
        not_applied = _harness.card_not_applied_reason(entry["path"])
    except ValueError as exc:
        if strict:
            raise RegistryError(f"eval set {name!r}: {exc}") from exc
        out["note"] = str(exc)
        return out
    meta, envelope = terms["meta"], terms["envelope"]
    card = meta.get("corpus_card") or {}
    rid = str(meta.get("id") or "").strip()
    if rid:
        if str(envelope.get("id") or "").strip() == rid:
            source = "corpus envelope (dataset.id)"
        elif card.get("id") == rid:
            source = f"corpus card {card.get('path')}"
        else:
            source = "steward sidecar (id)"
        out.update(dataset_id=rid, dataset_id_source=source)
    if card:
        out["corpus_card"] = {"id": card.get("id"), "path": card.get("path")}
    if not_applied:
        out["note"] = not_applied
    return out


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
        dataset_id: str | None = None,
        dataset_id_source: str | None = None,
    ) -> dict:
        """Register ``file_path`` as eval set ``name``.

        ``dataset_id`` is for an id the FILE cannot tell us — the mt-eval
        registry id ``add-harness`` materialized. Ids the file's own terms
        carry (a JSON envelope's ``dataset.id``, a registered corpora card,
        the steward sidecar) are resolved live by :meth:`identity`, so a card
        registered after this call still names the set.
        """
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
            raise RotationRefused(**self.rotation_refusal(name, existing, sha,
                                                          role))
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
        if dataset_id:
            entry["dataset_id"] = str(dataset_id)
            entry["dataset_id_source"] = dataset_id_source or "given"
        replaced = self.rotation_record(name, existing) if existing else None
        # a rotation names what it replaced and how much the old content had
        # been read — the ledger keeps every earlier read under this name, so
        # a test set that was already scored never looks fresh
        event = self.ledger.append(
            "rotate" if existing else "register",
            set=name, role=role, sha256=sha, rows=len(rows), path=str(file_path),
            **({"replaces": replaced} if replaced else {}),
        )
        entry["created_utc"] = event["ts"]
        if replaced:
            entry["rotated_from"] = {**replaced, "rotated_utc": event["ts"]}
        if role in WATCHED_ROLES:
            # the read log starts now: runs of this exact content mt-eval
            # made before it are found in its RunLogs and SAID, never counted
            entry["reads_before_registration"] = \
                self._earlier_runs(file_path, sha)
            n_before = len(entry["reads_before_registration"]["runs"])
            if n_before:
                self.ledger.append(
                    "reads-before-registration", set=name, sha256=sha,
                    runs=[r["run_id"] for r in
                          entry["reads_before_registration"]["runs"]],
                    counted=False)
        data["sets"][name] = entry
        self._write(data)
        if role in WATCHED_ROLES:
            self.watch(name, entry)
        return entry

    def _earlier_runs(self, file_path: Path, sha: str) -> dict:
        """:func:`earlier_harness_runs` around this workspace: the test
        file's folder, the project folder (the workspace's parent) and the
        working directory; run ids the file's read log already holds are
        counted reads, so they are left out."""
        counted = []
        log = read_log_path(file_path)
        if log.is_file():
            try:
                for line in log.read_text(encoding="utf-8").splitlines():
                    try:
                        rec = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(rec, dict) and rec.get("run_id"):
                        counted.append(str(rec["run_id"]))
            except OSError:
                pass
        roots = [file_path.parent, self.path.parent.parent, Path.cwd()]
        return earlier_harness_runs(sha, roots=roots, counted=counted)

    # -- reads made outside forge (the harness) ----------------------------------
    def watch(self, name: str, entry: dict | None = None) -> dict:
        """Make sure a test/sealed set's read log exists, so ``mt-eval`` can
        record its reads of the file. Idempotent: one ``watch`` line per
        (set, content). Returns ``{log, watching, error}`` — a folder forge
        cannot write to is said (``error``), never a crash: the harness then
        has nowhere to record, and status says the reads are not tracked."""
        from datetime import datetime, timezone

        from . import __version__

        entry = entry or self.get(name)
        log = read_log_path(entry["path"])
        out = {"log": str(log), "watching": False, "error": None}
        try:
            if log.is_file():
                for line in log.read_text(encoding="utf-8").splitlines():
                    try:
                        rec = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if (rec.get("event") == "watch" and rec.get("set") == name
                            and rec.get("sha256") == entry["sha256"]):
                        out["watching"] = True
                        return out
            rec = {"event": "watch", "tool": "nmt-forge",
                   "tool_version": __version__, "set": name,
                   "role": entry["role"], "sha256": entry["sha256"],
                   "ts": datetime.now(timezone.utc).isoformat(
                       timespec="seconds"),
                   "note": ("mt-eval appends one content-free line here "
                            "each time it scores this file (run / compare); "
                            "nmt-forge counts those reads of its "
                            f"{entry['role']} set")}
            with log.open("a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            out["watching"] = True
        except OSError as e:
            out["error"] = f"{type(e).__name__}: {e}"
        return out

    def harness_reads(self, name: str) -> dict:
        """Reads of this set's CURRENT content recorded by ``mt-eval`` in its
        read log: ``{log, watched, reads, by_purpose, run_ids, first, last,
        other_content, unparseable}``. ``other_content`` counts reads of a
        different sha256 (the file before a rotation, or edited); a line
        that does not parse is counted, never trusted. Content-free."""
        entry = self.get(name)
        log = read_log_path(entry["path"])
        before = entry.get("reads_before_registration") or {}
        out = {"log": str(log), "watched": log.is_file(), "reads": 0,
               "by_purpose": {}, "run_ids": [], "first": None, "last": None,
               "other_content": 0, "unparseable": 0,
               # mt-eval runs of this content found at registration, made
               # BEFORE the read log existed: said, never counted
               "before_registration": list(before.get("runs") or [])}
        if not log.is_file():
            return out
        try:
            lines = log.read_text(encoding="utf-8").splitlines()
        except OSError as e:
            out["error"] = f"{type(e).__name__}: {e}"
            return out
        for line in lines:
            if not line.strip():
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                out["unparseable"] += 1
                continue
            if not isinstance(rec, dict) or rec.get("event") != "read":
                continue
            if rec.get("sha256") != entry["sha256"]:
                out["other_content"] += 1
                continue
            out["reads"] += 1
            purpose = str(rec.get("purpose") or "?")
            out["by_purpose"][purpose] = out["by_purpose"].get(purpose, 0) + 1
            if rec.get("run_id"):
                out["run_ids"].append(str(rec["run_id"]))
            out["first"] = out["first"] or rec.get("ts")
            out["last"] = rec.get("ts") or out["last"]
        return out

    # -- rotation ---------------------------------------------------------------
    def rotation_record(self, name: str, existing: dict) -> dict:
        """What rotating ``name`` replaces: the old content's hash, role and
        rows, and how often it was read (by purpose) before the rotation."""
        spend = self.ledger.spend_report(name)
        outside = (self.harness_reads(name)["reads"]
                   if existing["role"] in WATCHED_ROLES else 0)
        return {"sha256": existing["sha256"], "role": existing["role"],
                "rows": existing.get("rows"),
                "reads_by_purpose": spend["reads_by_purpose"],
                "score_reads": spend["reads_by_purpose"].get("score", 0),
                **({"harness_reads": outside} if outside else {})}

    def rotation_refusal(self, name: str, existing: dict, sha: str,
                         role: str) -> dict:
        """The refusal for replacing a registered set without --allow-rotate,
        as ``{message, why, fix}`` — the fix names the CLI flag and the MCP
        parameter (never a Python argument), the message what was read."""
        rec = self.rotation_record(name, existing)
        reads = rec["reads_by_purpose"]
        read_note = (
            "its current content was already read "
            + ", ".join(f"{n}× for {p}" for p, n in sorted(reads.items()))
            + " — those reads stay in the ledger under this name"
            if reads else "its current content has not been read yet")
        what = ("content" if existing["role"] == role else
                f"role ({existing['role']} → {role})")
        return {
            "message": (f"eval set {name!r} is already registered with "
                        f"different {what} (sha {existing['sha256'][:12]}… vs "
                        f"{sha[:12]}…); {read_note}"),
            "why": ("replacing a registered eval set changes what every later "
                    "score means, so it is a deliberate, ledgered act — "
                    "preregistrations bound to the old content stop applying"),
            "fix": ("if the replacement is deliberate, add --allow-rotate "
                    f"(`nmt-forge registry add {name} <file> --role {role} "
                    "--allow-rotate`, or `nmt-forge split … --register "
                    "<prefix> --allow-rotate`; MCP: forge_split / "
                    "forge_register_eval with allow_rotate: true). Otherwise "
                    "register the new file under a new name"),
        }

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

    def identity(self, name: str, *, strict: bool = True) -> dict:
        """What ``mt-eval`` calls this set, next to forge's own name for it
        (:func:`dataset_identity`)."""
        return dataset_identity(name, self.get(name), strict=strict)

    def text_withheld(self, name: str, *, identity: dict | None = None) -> str:
        """Why this set's sentences must not be printed, or ``""`` — the
        harness's verdict on the file (``privacy.withheld_reason``)."""
        from .privacy import withheld_reason

        entry = self.get(name)
        ident = identity or dataset_identity(name, entry, strict=False)
        given = ("" if ident["dataset_id_source"] == FORGE_NAME_SOURCE
                 else ident["dataset_id"])
        return withheld_reason(entry["path"], dataset_id=given)

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
        prereg_id: str | None = None,
    ) -> list[dict]:
        """Load a registered set's rows: sha-verified, ledgered, spend-gated.

        ``prereg_id``: the preregistration a score read was admitted under,
        recorded on the read so the run stays bound to it.

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
                "If the change is deliberate, register it again explicitly: "
                f"`nmt-forge registry add {name} {path} --role {entry['role']} "
                "--allow-rotate` (MCP: forge_register_eval with allow_rotate: "
                "true) — the rotation is ledgered — or register the new file "
                "under a new name."
            )
        if entry["role"] in WATCHED_ROLES:
            self.watch(name, entry)        # sets registered before 0.2.x
        outside = (self.harness_reads(name)
                   if entry["role"] == "sealed" and purpose == "score"
                   else None)
        if outside and outside["reads"] and not override_respend:
            # mt-eval scored this sealed file outside forge: its one shot is
            # gone, whichever tool took it
            raise SealedSetSpent(
                f"sealed set {name!r} was already scored by mt-eval "
                f"{outside['reads']} time(s) "
                f"({', '.join(f'{n}× {p}' for p, n in sorted(outside['by_purpose'].items()))}"
                f"; recorded in {outside['log']})",
                why="a sealed set answers one question once; a read by the "
                    "harness spends it just as a read by forge does",
                fix="evaluate on a dev/test-role set instead; if you truly "
                    "must re-spend, add --override-respend '<reason>' to "
                    "`nmt-forge score` / `nmt-forge compare` — the "
                    "override is ledgered and visible forever",
            )
        if outside and outside["reads"] and override_respend:
            self.ledger.append("override", set=name, kind="sealed-respend",
                               reason=override_respend,
                               harness_reads=outside["reads"])
        if entry["role"] == "sealed" and purpose == "score":
            if self.ledger.sealed_spent(name) and not override_respend:
                raise SealedSetSpent(
                    f"sealed set {name!r} has already been spent",
                    why="a sealed set answers one question once; re-scoring it "
                        "turns the final exam into a dev set",
                    fix="evaluate on a dev/test-role set instead; if you truly "
                        "must re-spend, add --override-respend '<reason>' to "
                        "`nmt-forge score` / `nmt-forge compare` — the "
                        "override is ledgered and visible forever",
                )
            if self.ledger.sealed_spent(name) and override_respend:
                self.ledger.append(
                    "override", set=name, kind="sealed-respend", reason=override_respend,
                )
        self.ledger.append(
            "read", set=name, role=entry["role"], purpose=purpose,
            config_hash=config_hash, sha256=sha,
            **({"prereg_id": prereg_id} if prereg_id else {}),
        )
        return load_rows(path)

    # -- derived views ----------------------------------------------------------
    def key_sets(
        self, roles: tuple[str, ...] = ("test", "sealed"), canonicalizer=None
    ) -> dict[str, dict]:
        """Canonical source/target key sets per registered set (loaded live).

        Returns ``{name: {"source": set, "target": set, "role": str,
        "source_rows": {key: first row index}, "target_rows": {…},
        "rows": int}}``. The ``*_rows`` maps (in FILE order) let leak-audit
        name which eval row a corpus row matched, deterministically; they hold
        row indices, never text. Used by dev-fence content checks and
        leak-audit. These reads are the machinery's own audit, not a score —
        ledgered as purpose ``audit``, never spend-gated.
        """
        out: dict[str, dict] = {}
        for name in self.names(roles):
            entry = self.get(name)
            rows = self.open_eval(name, "audit")
            src_f, tgt_f = entry["source_field"], entry["target_field"]
            src_rows: dict[str, int] = {}
            tgt_rows: dict[str, int] = {}
            for i, r in enumerate(rows):
                src_rows.setdefault(
                    canonical_key(str(r.get(src_f, "")), canonicalizer), i)
                tgt_rows.setdefault(
                    canonical_key(str(r.get(tgt_f, "")), canonicalizer), i)
            out[name] = {
                "source": set(src_rows),
                "target": set(tgt_rows),
                "role": entry["role"],
                "source_rows": src_rows,
                "target_rows": tgt_rows,
                "rows": len(rows),
            }
        return out
