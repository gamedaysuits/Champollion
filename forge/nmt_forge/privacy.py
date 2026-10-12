"""Which corpus sentences forge PRINTS — the harness decides, forge obeys.

A steward who marks a test set local-only (a ``<file>.champollion.json``
sidecar ``{"transmission": "local-only"}``, usually written by
``champollion network register-corpus --tier local-only``) is promised that the text
does not leave the machine. forge is driven by AI agents, and an agent sends
whatever it reads in the terminal to its own model provider — so a command
that prints the teacher-checked sentences breaks that promise with forge's
own output. The rule, shared with ``mt-eval`` (harness
``transmission_policy.withheld_text_reason``):

- a corpus that is local-only, sealed or consent-required has its sentences
  WITHHELD from terminal and ``--json`` output: forge prints line numbers,
  ids, counts and scores instead, and says once why;
- ``--show-text`` prints them anyway — for a person at the terminal, never
  for an agent;
- files forge writes into the user's own folders (split sides, cleaned
  corpora, hypotheses, the mt-eval RunLog) keep the text; a file CARVED from
  a marked corpus carries the mark (``carry_mark``), so its pieces stay
  protected wherever they go next.

forge implements none of the policy: every decision is a harness call made
through ``_harness`` (``withheld_text_reason``, ``withheld_note``,
``scrub_corpus_text``, ``merge_steward_sidecar``).
"""

from __future__ import annotations

import json
from pathlib import Path

from . import _harness

SHOW_TEXT_FLAG = "--show-text"

#: The flag's help where a command can print corpus sentences (leak-audit).
SHOW_TEXT_HELP = (
    "print corpus sentences even when the corpus (or the eval set a row "
    "matched) is local-only, sealed or consent-required — otherwise line "
    "numbers, ids and scores are printed instead. Only for a person at the "
    "terminal: an AI agent that reads this output sends it to its model "
    "provider. --json output never carries sentences")

#: The flag's help where sentences can only appear inside an error message
#: (a metric plugin, tokenizer or model quoting a row it choked on).
SHOW_TEXT_ERRORS_HELP = (
    "show corpus sentences inside error messages (e.g. a metric plugin's "
    "error quoting a row) even for local-only, sealed or consent-required "
    "corpora — otherwise they read [sentence withheld]. This command prints "
    "no sentences otherwise. Only for a person at the terminal: an AI agent "
    "that reads this output sends it to its model provider")

#: Where forge's sidecars say a derived file's mark came from.
DERIVED_KEY = "derived_from"


def withheld_reason(path, *, dataset_id: str = "") -> str:
    """Why this corpus file's sentences must not be printed, or ``""``
    (harness ``withheld_text_reason`` over the file's resolved policy)."""
    return _harness.withheld_text_reason(path, dataset_id=dataset_id)


def note(reason: str, *, flag: bool = True) -> str:
    """The one line a command prints where it withheld sentences — the
    harness's wording when the command offers ``--show-text``."""
    if flag:
        return _harness.transmission_policy_mod().withheld_note(reason)
    return (f"Sentence text withheld: {reason}. It is replaced with "
            f"[sentence withheld] — an AI agent reading this output would "
            f"send it to its model provider.")


def combine(reasons: dict[str, str]) -> str:
    """``{label: reason}`` → one reason string for :func:`note` (labels
    with an empty reason are left out)."""
    return "; ".join(f"{label}: {why}" for label, why in reasons.items()
                     if why)


# -- marks follow the text ------------------------------------------------------

#: the sidecar fields a carried mark is made of (the harness's vocabulary)
MARK_FIELDS = ("transmission", "segment", "license")


def carried_mark(source, *, dataset_id: str = "") -> dict:
    """The terms a file carved from ``source`` must carry, or ``{}``.

    The harness's merged view of the source (``corpus_terms``: its JSON
    envelope + steward sidecar): a local-only ``transmission``, a sealed
    ``segment`` and a declared ``license`` — joined, strictly, with the
    harness's own mark for derived files (``corpus_loader.derived_mark``,
    via ``_harness.derived_mark``), which also covers a set the mt-eval
    registry seals or marks consent-required. One shape for both: the
    sidecar ``mt-eval`` writes next to its run logs and reports. A carved
    JSONL has no envelope, so without a sidecar of its own the pieces of a
    local-only corpus would read as unmarked — and be printed, and be
    sendable to remote models. Never the card pointer or its sha256: those
    describe the source file. Raises ForgeError when the source's terms
    cannot be read (a steward wrote them to restrict the data; a typo must
    not unlock its pieces).
    """
    from .errors import ForgeError

    try:
        meta = _harness.corpus_terms(source)["meta"]
        harness_mark = _harness.derived_mark(source, dataset_id=dataset_id)
    except ValueError as exc:
        raise ForgeError(
            f"{source}: its terms could not be read ({exc})\n"
            "  why: the files carved from it must carry the same terms, and "
            "an unreadable sidecar is not 'no terms'\n"
            "  fix: correct the .champollion.json sidecar (a JSON object, "
            'e.g. {"transmission": "local-only"}) and run again') from exc
    mark: dict = {}
    if str(meta.get("transmission") or "").strip().lower() == "local-only":
        mark["transmission"] = "local-only"
    seg = str(meta.get("segment") or "").strip()
    if seg.lower() in ("held_out", "gold_standard"):
        mark["segment"] = seg
    if str(meta.get("license") or "").strip():
        mark["license"] = str(meta["license"]).strip()
    return merge_marks(mark, harness_mark)


def merge_marks(*marks) -> dict:
    """Several marks as one, strictly: any protection on any of them holds
    (the harness's rule for a file derived from several runs)."""
    out: dict = {}
    for m in marks:
        for key in MARK_FIELDS:
            value = (m or {}).get(key)
            if isinstance(value, str) and value.strip():
                out.setdefault(key, value.strip())
    return out


def carry_mark(source, outputs, *, command: str,
               mark: dict | None = None) -> dict | None:
    """Write ``<out>.champollion.json`` next to every file in ``outputs``
    when ``source`` carries terms (:func:`carried_mark`; pass ``mark`` when
    it was read before the outputs were written, so an unreadable source
    refuses before anything is carved). Returns ``{"from", "mark",
    "sidecars": [..]}`` or None (nothing to carry).

    A sidecar can only make a corpus stricter (harness
    ``merge_steward_sidecar``), and every field written here is the
    source's own — forge adds only where it came from. A sidecar already
    next to an output (``mt-eval`` marks the TestReport it writes) is
    joined, never loosened: its mark fields survive the rewrite.
    """
    mark = carried_mark(source) if mark is None else mark
    if not mark:
        return None
    sidecars = []
    for out in outputs:
        side = Path(str(out) + ".champollion.json")
        try:
            existing = json.loads(side.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            existing = {}
        body = dict(merge_marks(mark, existing if isinstance(existing, dict)
                                else {}),
                    **{DERIVED_KEY: Path(source).name,
                       "written_by": f"nmt-forge {command}"})
        side.write_text(json.dumps(body, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
        sidecars.append(str(side))
    return {"from": str(source), "mark": mark, "sidecars": sidecars}


def render_carried(carried: dict | None) -> list[str]:
    """The human line for :func:`carry_mark`'s result."""
    if not carried:
        return []
    terms = ", ".join(f"{k} {v}" for k, v in carried["mark"].items())
    return [f"  the written files keep {Path(carried['from']).name}'s terms "
            f"({terms}): a .champollion.json sidecar next to each"]


# -- error messages ---------------------------------------------------------------

_TEXT_FIELDS = ("source", "target", "reference")


def _rows_texts(path, fields) -> list[str]:
    from .registry import load_rows

    try:
        rows = load_rows(path)
    except Exception:   # an unloadable file cannot have put text in the error
        return []
    out = []
    for r in rows:
        for f in fields:
            v = r.get(f)
            if isinstance(v, str) and v.strip():
                out.append(v)
    return out


def _registered_candidates(workspace) -> list[tuple[str, tuple, str]]:
    """(path, text fields, dataset id) for every set in a workspace's
    registry, read WITHOUT creating the workspace."""
    if not workspace:
        return []
    reg = Path(workspace) / "eval-registry.json"
    try:
        sets = json.loads(reg.read_text(encoding="utf-8")).get("sets", {})
    except (OSError, ValueError, AttributeError):
        return []
    out = []
    for e in sets.values():
        if isinstance(e, dict) and e.get("path"):
            fields = tuple(f for f in (e.get("source_field"),
                                       e.get("target_field")) if f)
            out.append((e["path"], fields or _TEXT_FIELDS,
                        str(e.get("dataset_id") or "")))
    return out


def scrub_text_of(message: str, path) -> str:
    """``message`` with every sentence of the corpus at ``path`` replaced by
    the harness's ``[sentence withheld]`` — WHATEVER the corpus's terms.

    For text bound for a place that must hold no corpus text at all (the
    deployable model directory's forge-model.json), where "the set is not
    marked" is no reason to let a plugin's error quote a row."""
    if not message:
        return message
    texts = _rows_texts(path, _TEXT_FIELDS)
    if not texts:
        return message
    return _harness.transmission_policy_mod().scrub_corpus_text(message,
                                                                 texts)


def scrub_error(message: str, *, workspace=None, paths=(),
                show_text: bool = False) -> tuple[str, str]:
    """``(message, reason)``: ``message`` with every sentence of a withheld
    corpus replaced by the harness's ``[sentence withheld]``.

    forge's own refusals are content-free; this is the net under OTHER
    code's errors — a metric plugin, tokenizer or model that quotes the row
    it choked on. The candidates are the workspace's registered sets plus
    the corpus files the command was given (``paths``). A corpus's terms
    are looked up only when its text actually appears in the message.
    ``reason`` is ``""`` when nothing was replaced.
    """
    if show_text or not message:
        return message, ""
    tp = _harness.transmission_policy_mod()
    candidates = _registered_candidates(workspace) + [
        (str(p), _TEXT_FIELDS, "") for p in paths if p]
    reasons: dict[str, str] = {}
    seen: set[str] = set()
    for path, fields, did in candidates:
        key = str(Path(path).resolve())
        if key in seen:
            continue
        seen.add(key)
        texts = _rows_texts(path, fields)
        if not texts or tp.scrub_corpus_text(message, texts) == message:
            continue
        why = withheld_reason(path, dataset_id=did)
        if why:
            message = tp.scrub_corpus_text(message, texts)
            reasons[Path(path).name] = why
    return message, combine(reasons)
