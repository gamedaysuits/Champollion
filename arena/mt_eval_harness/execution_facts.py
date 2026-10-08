"""execution_facts — counts-only runtime accounting and the diagnostics channel.

Two things live here, and both exist because of the same doctrine: the
organizer's node publishes AGGREGATES ONLY (contest_node.py:32-36,
airgap_transport.py:51-55). No per-entry text, no hypothesis, no source
sentence, no stderr body ever leaves the node.

1. EXECUTION FACTS — what it cost to run a method (wall clock, build/run
   split, the image digest, the node's own resource caps). These ride the
   run card (``run_card["execution"]``, contract C4) and are REPORTED on the
   contest ranking, never ranked (contract C7): an efficiency track does not
   exist yet, and pretending a fast method won something it did not is the
   kind of quiet over-claim this repo refuses.

2. DIAGNOSTICS — the counts-only answer to "what happened to my submission?"
   (practice 12). A participant whose method failed inside a sealed node
   otherwise learns nothing at all. The channel is deliberately narrow:
   an outcome, the STAGE it stopped at, an exit code, and counts. Never a
   stderr tail, never an output line, never a corpus row. ``no_text_guard``
   enforces that shape mechanically rather than by convention — every value
   is a number, a bool, None, or one of the short enum strings below.

The transport is ``authorization_requests.execution_diagnostics`` (JSONB,
migration 074). On a database that predates 074 the write FAILS LOUD, naming
the column — the caller decides whether that is fatal. It is not: a missing
diagnostics column must never turn a scored run into a failed one, so
``run_method_request``/``import_scores`` catch exactly
``DiagnosticsColumnMissing``, print one line, and carry on.
"""

from __future__ import annotations

from typing import Any, Optional

try:                                    # TypedDict moved in 3.12's typing
    from typing import TypedDict
except ImportError:                     # pragma: no cover - ancient runtimes
    from typing_extensions import TypedDict  # type: ignore


__all__ = [
    "DIAGNOSTICS_COLUMN",
    "DIAGNOSTICS_TABLE",
    "EXECUTION_KEYS",
    "MAX_DIAGNOSTIC_STRING",
    "OUTCOMES",
    "STAGES",
    "Diagnostics",
    "DiagnosticsColumnMissing",
    "DiagnosticsError",
    "SandboxError",
    "execution_from_facts",
    "failure_diagnostics",
    "no_text_guard",
    "output_line_counts",
    "record_execution_diagnostics",
    "scored_diagnostics",
]

DIAGNOSTICS_TABLE = "authorization_requests"
DIAGNOSTICS_COLUMN = "execution_diagnostics"

#: A diagnostics value may be a string ONLY if it is short enough to be an
#: identifier/enum rather than content. 32 characters is well under any
#: sentence and comfortably over every enum member below.
MAX_DIAGNOSTIC_STRING = 32

#: The only two outcomes the channel reports.
OUTCOMES: tuple[str, ...] = ("failed", "scored")

#: Where a failed run stopped. Ordered as the pipeline runs.
#:   build       — the --network=none image build failed (§3.3)
#:   image-size  — the built image is over the §3.4 ceiling
#:   run         — the run could not be STARTED (source staging, runtime)
#:   timeout     — the container exceeded its wall clock
#:   exit        — the method exited non-zero
#:   no-output   — no /output/translations.txt was produced
#:   output-size — /output is over the §3.4 ceiling
#:   align       — output produced, but it does not cover the corpus exactly
#:   score       — alignment fine, scoring itself failed
STAGES: tuple[str, ...] = (
    "build", "image-size", "run", "timeout", "exit", "no-output",
    "output-size", "align", "score",
)

_ENUM_STRINGS = frozenset(OUTCOMES) | frozenset(STAGES)


class Diagnostics(TypedDict, total=False):
    """The counts-only shape written to ``execution_diagnostics``.

    Failure: ``outcome='failed'`` + ``stage`` + whichever counts are known.
    Success: ``outcome='scored'`` + ``n_scored`` + ``n_empty`` + runtime.
    """

    outcome: str
    stage: str
    exit_code: Optional[int]
    runtime_seconds: Optional[float]
    n_sources: Optional[int]
    n_output_lines: Optional[int]
    stderr_bytes: Optional[int]
    n_scored: Optional[int]
    n_empty: Optional[int]


class DiagnosticsError(RuntimeError):
    """A diagnostics record that could not be written — always with the reason."""


class DiagnosticsColumnMissing(DiagnosticsError):
    """The database has no ``execution_diagnostics`` column (pre-074).

    Raised so a caller can distinguish "this deployment cannot store
    diagnostics yet" from "the write was refused" — the first is a schema
    gap to report once, the second is a real failure.
    """


class SandboxError(RuntimeError):
    """A sandbox run that cannot proceed / produced no score — with the reason.

    Carries the counts-only ``diagnostics`` for the stage that failed, so the
    participant-facing channel does not have to re-derive it from a message
    string. ``diagnostics`` is None only for a refusal raised before any
    execution accounting exists (a config refusal, say).

    Defined here rather than in sandbox_runner so model_runner,
    airgap_transport and the diagnostics writer can share one class without
    importing the sandbox module; ``sandbox_runner.SandboxError`` is this
    exact class, re-exported.
    """

    def __init__(self, *args: Any, diagnostics: Optional[dict] = None) -> None:
        super().__init__(*args)
        self.diagnostics: Optional[dict] = diagnostics


# ---------------------------------------------------------------------------
# The shape guard — aggregates-only, enforced rather than promised.
# ---------------------------------------------------------------------------

def no_text_guard(diagnostics: Any, *, _path: str = "diagnostics") -> Any:
    """Raise ``DiagnosticsError`` unless every value is counts-only.

    Allowed leaves: numbers, bools, None, and strings that are either one of
    the ``OUTCOMES``/``STAGES`` enum members or at most
    ``MAX_DIAGNOSTIC_STRING`` characters long (an id, not a sentence).
    Anything longer is content — a stderr tail, an output line, a corpus
    row — and this channel does not carry content.

    Returns the value it was given so callers can guard inline.
    """
    if isinstance(diagnostics, dict):
        for key, value in diagnostics.items():
            if not isinstance(key, str):
                raise DiagnosticsError(
                    f"{_path}: keys must be strings (got {key!r}).")
            no_text_guard(value, _path=f"{_path}.{key}")
        return diagnostics
    if isinstance(diagnostics, (list, tuple)):
        for i, value in enumerate(diagnostics):
            no_text_guard(value, _path=f"{_path}[{i}]")
        return diagnostics
    if isinstance(diagnostics, str):
        if diagnostics in _ENUM_STRINGS:
            return diagnostics
        if len(diagnostics) > MAX_DIAGNOSTIC_STRING:
            raise DiagnosticsError(
                f"{_path}: the diagnostics channel is counts-only — a "
                f"{len(diagnostics)}-character string is content, not a "
                f"count or an id (limit {MAX_DIAGNOSTIC_STRING}). Never put "
                f"stderr, output lines or corpus text on this channel.")
        return diagnostics
    if diagnostics is None or isinstance(diagnostics, (bool, int, float)):
        return diagnostics
    raise DiagnosticsError(
        f"{_path}: unsupported diagnostics value type "
        f"{type(diagnostics).__name__} — counts, bools, short ids or None only.")


# ---------------------------------------------------------------------------
# Execution facts — the published shape (contract C4).
# ---------------------------------------------------------------------------

#: The keys ``run_card["execution"]`` carries for a sandbox (Lane B) run, in
#: report order. ``image_digest_note`` is added ONLY when there is no digest.
EXECUTION_KEYS: tuple[str, ...] = (
    "runtime_seconds", "build_seconds", "run_seconds", "runtime",
    "image_digest", "cpus", "ram_gb", "tmp_gb", "gpu", "pids_limit",
    "node_id", "source_count", "output_bytes",
)

#: Facts that stay on the node. A scratch path or a container name describes
#: the organizer's machine, not the run, and must never be published.
_NEVER_PUBLISHED = ("translations_path", "container_name", "image_tag")


def execution_from_facts(facts: dict, *, node_id: str) -> dict:
    """Project ``execute_method``'s facts into the published C4 shape.

    Every key is present even when the value is None — a missing key reads as
    "this build does not record it", a null reads as "we could not measure
    it", and only the second is true here.
    """
    execution = {key: facts.get(key) for key in EXECUTION_KEYS}
    execution["node_id"] = node_id
    if facts.get("image_digest") is None and facts.get("image_digest_note"):
        execution["image_digest_note"] = facts["image_digest_note"]
    leaked = [k for k in _NEVER_PUBLISHED if k in execution]
    if leaked:                                   # pragma: no cover - guard
        raise DiagnosticsError(
            f"execution facts must never carry {leaked} — those are node-local "
            f"paths/names, not published facts.")
    return execution


def output_line_counts(path: Any) -> tuple[int, int]:
    """``(total_lines, blank_lines)`` of a method's output file.

    Counts only — the file itself is corpus-shaped and never read out of the
    node. A missing file is (0, 0): the caller already has a better error.
    """
    from pathlib import Path as _Path

    p = _Path(path)
    if not p.is_file():
        return 0, 0
    lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
    return len(lines), sum(1 for line in lines if not line.strip())


# ---------------------------------------------------------------------------
# Builders — one place each, so the two lanes cannot drift.
# ---------------------------------------------------------------------------

def failure_diagnostics(stage: str, *, exit_code: Optional[int] = None,
                        runtime_seconds: Optional[float] = None,
                        n_sources: Optional[int] = None,
                        n_output_lines: Optional[int] = None,
                        stderr_bytes: Optional[int] = None) -> Diagnostics:
    """The counts-only record of a run that produced no score."""
    if stage not in STAGES:
        raise DiagnosticsError(
            f"unknown diagnostics stage {stage!r}; known stages: "
            f"{', '.join(STAGES)}")
    d: Diagnostics = {
        "outcome": "failed",
        "stage": stage,
        "exit_code": exit_code,
        "runtime_seconds": (None if runtime_seconds is None
                            else round(float(runtime_seconds), 3)),
        "n_sources": n_sources,
        "n_output_lines": n_output_lines,
        "stderr_bytes": stderr_bytes,
    }
    no_text_guard(d)
    return d


def scored_diagnostics(*, n_scored: int, n_empty: int,
                       runtime_seconds: Optional[float] = None) -> Diagnostics:
    """The counts-only record of a run that scored.

    ``n_empty`` is how many of the method's output lines were blank — the one
    quality signal that is a count rather than text, and the difference
    between "your method ran" and "your method ran and emitted nothing".
    """
    d: Diagnostics = {
        "outcome": "scored",
        "n_scored": int(n_scored),
        "n_empty": int(n_empty),
        "runtime_seconds": (None if runtime_seconds is None
                            else round(float(runtime_seconds), 3)),
    }
    no_text_guard(d)
    return d


# ---------------------------------------------------------------------------
# The transport.
# ---------------------------------------------------------------------------

def _looks_like_missing_column(message: str) -> bool:
    """True when PostgREST is saying the column is not in the schema."""
    low = message.lower()
    if DIAGNOSTICS_COLUMN not in low:
        return False
    return any(marker in low for marker in (
        "does not exist",          # PostgreSQL 42703
        "pgrst204",                # PostgREST: column not found in cache
        "could not find",
        "schema cache",
        "unknown column",
    ))


def record_execution_diagnostics(request_id: str,
                                 diagnostics: Optional[dict]) -> dict:
    """PATCH one request's ``execution_diagnostics``. Fails loud, always.

    Raises ``DiagnosticsColumnMissing`` (naming the column and the migration)
    when the deployment predates 074, and ``DiagnosticsError`` when the write
    matched no row — a silently-dropped diagnostics record would be worse
    than none, because the operator would believe the channel works.
    """
    if not request_id:
        raise DiagnosticsError(
            "record_execution_diagnostics needs a request_id — diagnostics "
            "are keyed by the authorization request they describe.")
    if diagnostics is None:
        raise DiagnosticsError(
            f"record_execution_diagnostics({request_id!r}) got no diagnostics "
            f"— pass a counts-only dict, never None.")
    no_text_guard(diagnostics)

    from mt_eval_harness.sovereign_service import service_request

    try:
        rows = service_request(
            "PATCH", DIAGNOSTICS_TABLE,
            data={DIAGNOSTICS_COLUMN: diagnostics},
            params={"request_id": f"eq.{request_id}"},
            prefer="return=representation")
    except RuntimeError as exc:
        if _looks_like_missing_column(str(exc)):
            raise DiagnosticsColumnMissing(
                f"{DIAGNOSTICS_TABLE}.{DIAGNOSTICS_COLUMN} does not exist on "
                f"this database — apply migration 074 to enable the "
                f"counts-only diagnostics channel. The run itself is "
                f"unaffected. (server said: {exc})") from exc
        raise
    if isinstance(rows, list) and not rows:
        raise DiagnosticsError(
            f"diagnostics PATCH for request {request_id!r} matched 0 rows — "
            f"no such authorization request, or it is not visible to this "
            f"key. Nothing was recorded.")
    return {"request_id": request_id, "diagnostics": diagnostics,
            "rows": rows if isinstance(rows, list) else []}
