"""The harness's score caveats, relayed — never recomputed.

mt-eval-harness writes ``score_caveats`` into the TestReport it computes
(``mt_eval_harness.score_caveats``): what qualifies the headline numbers —
one output given for many different inputs (``near_constant_output``),
length inflation or deflation, copies of the source, and forge's own
near-twin reading echoed back. forge implements zero metric math, so it
computes zero caveats: it relays the harness's list, entry for entry and in
the harness's own words, wherever it shows or recommends a score — the
export summary, ``forge-model.json``, DEPLOY.md (beside any "number to
quote"), ``status``, ``report``, ``compare`` and ``lint``.

Why (synthetic users, Round 13, 2026-10-04): the harness flagged a
twin-free model's test output as near-constant — 150 of 150 sources got one
of only 9 outputs (hospital persona), 196 of 200 one of 5 (school persona)
— while every forge surface left it out, and the all-data model's DEPLOY.md
called that model's chrF++ "the number to quote for new sentences". An
agent following forge's own next steps would have quoted it as how the
model translates unseen sentences.

Rules:

- the list is the harness's, verbatim (``kind``, ``source``, ``severity``,
  ``message`` and its numbers); forge never rewords a message or decides a
  severity;
- a TestReport with no ``score_caveats`` key (an older harness, or nothing
  to qualify — the harness writes the key only when there is one) gets NO
  sentence: absence is never turned into "no caveats";
- in prose, the entry that is forge's OWN near-twin reading (kind
  ``train_test_near_twin``, source ``nmt-forge``) is not printed twice: every
  surface already prints that reading from forge's own summary, in the same
  words. JSON keeps the whole list.
"""

from __future__ import annotations

import json
from pathlib import Path

#: The harness's kind for forge's own near-twin reading, echoed back into
#: the TestReport (``mt_eval_harness.score_caveats.NEAR_TWIN``).
FORGE_NEAR_TWIN_KIND = "train_test_near_twin"

#: The TestReport file an export's evaluation folder holds (harness_bridge).
TEST_REPORT_NAME = "runlog_report.json"


def from_report(report: dict | None) -> list[dict] | None:
    """The TestReport's ``score_caveats``, as the harness wrote them, or
    None when the report carries no such key (said as nothing at all)."""
    if not isinstance(report, dict) or "score_caveats" not in report:
        return None
    raw = report.get("score_caveats")
    if not isinstance(raw, list):
        return None
    return [dict(c) for c in raw if isinstance(c, dict)]


def read_report(path) -> dict:
    """``{"score_caveats": list | None, "error": str | None}`` from a
    TestReport file. The file holds the test set's sentences: only the
    caveat list is kept (the harness's caveats are counts — never text)."""
    try:
        doc = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        return {"score_caveats": None,
                "error": f"mt-eval TestReport unreadable ({type(e).__name__}"
                         f": {e})"}
    return {"score_caveats": from_report(doc), "error": None}


def for_export(fm_path, doc: dict | None) -> dict:
    """An export's harness caveats: ``forge-model.json``'s
    ``test_report.score_caveats`` (exports from Round 13 on), else read from
    the TestReport its ``harness.test_report`` points at (older exports —
    the harness wrote the caveats there all along). ``{"score_caveats",
    "from", "error"}``; ``score_caveats`` None = nothing to say."""
    doc = doc or {}
    tr = doc.get("test_report") or {}
    if "score_caveats" in tr:
        caveats = tr.get("score_caveats")
        return {"score_caveats": ([dict(c) for c in caveats
                                   if isinstance(c, dict)]
                                  if isinstance(caveats, list) else None),
                "from": "forge-model.json", "error": None}
    rel = (doc.get("harness") or {}).get("test_report")
    if not tr or not rel or fm_path is None:
        return {"score_caveats": None, "from": None, "error": None}
    path = Path(fm_path).parent / rel
    if not path.is_file():
        return {"score_caveats": None, "from": None, "error": None}
    got = read_report(path)
    return {**got, "from": str(path)}


def matching_test_report(manifest: dict, manifest_path) -> Path | None:
    """The mt-eval TestReport written from the same gated read as a battery
    manifest: the one it records (``harness_report.path``, Round 13 on),
    else — an export's evaluation folder, written before that — the
    ``runlog_report.json`` beside it, when it names the same forge set and
    scores exactly the outputs of the hypotheses file beside the manifest
    (``<name>.jsonl`` for ``<name>-battery.json``, as ``evaluate`` writes
    them): the harness's caveats are about those outputs. Compared in
    memory only; nothing is printed."""
    if manifest_path is None:
        return None
    mp = Path(manifest_path)
    base = mp.parent
    rec = manifest.get("harness_report") or {}
    if rec.get("path"):
        p = Path(rec["path"])
        p = p if p.is_absolute() else base / p
        return p if p.is_file() else None
    cand = base / TEST_REPORT_NAME
    suffix = "-battery.json"
    hyps = (base / (mp.name[:-len(suffix)] + ".jsonl")
            if mp.name.endswith(suffix) else None)
    if not cand.is_file() or hyps is None or not hyps.is_file():
        return None
    try:
        doc = json.loads(cand.read_text(encoding="utf-8"))
        outputs = [json.loads(line).get("predicted")
                   for line in hyps.read_text(encoding="utf-8").splitlines()
                   if line.strip()]
    except (OSError, json.JSONDecodeError, AttributeError):
        return None
    overall = doc.get("overall") or {}
    if overall.get("nmt_forge_set") != manifest.get("eval_set"):
        return None
    scored = [e.get("predicted") for e in doc.get("entries") or []
              if isinstance(e, dict)]
    return cand if outputs and scored == outputs else None


def for_battery_manifest(manifest: dict, manifest_path=None) -> list | None:
    """A battery manifest's harness caveats: the ones it records (Round 13
    on), else the matching TestReport's (:func:`matching_test_report`)."""
    rec = manifest.get("harness_report")
    if isinstance(rec, dict) and "score_caveats" in rec:
        caveats = rec.get("score_caveats")
        return ([dict(c) for c in caveats if isinstance(c, dict)]
                if isinstance(caveats, list) else None)
    path = matching_test_report(manifest, manifest_path)
    return read_report(path)["score_caveats"] if path else None


# -- what prose shows -----------------------------------------------------------

def is_forge_reading(c: dict) -> bool:
    """forge's own near-twin reading echoed back by the harness — printed by
    every forge surface from forge's own summary already."""
    return (c.get("kind") == FORGE_NEAR_TWIN_KIND
            and c.get("source") == "nmt-forge")


def relayed(caveats: list | None) -> list[dict]:
    """The harness caveats a forge prose surface prints: all but forge's
    own near-twin reading (see the module docstring), major first in the
    harness's order."""
    out = [c for c in caveats or [] if isinstance(c, dict)
           and not is_forge_reading(c)]
    return sorted(out, key=lambda c: c.get("severity") != "major")


def majors(caveats: list | None) -> list[dict]:
    """The relayed caveats the harness calls ``major``."""
    return [c for c in relayed(caveats) if c.get("severity") == "major"]


def _message(c: dict) -> str:
    text = str(c.get("message") or c.get("kind") or "caveat").strip()
    return text if text[-1:] in ".!?…" else text + "."


def head(c: dict) -> str:
    """``⚠ SCORE CAVEAT (<source>)`` for a major caveat, ``⚠ score note
    (<source>)`` for a minor one — the harness's own two heads."""
    return (("⚠ SCORE CAVEAT" if c.get("severity") == "major"
             else "⚠ score note") + f" ({c.get('source') or 'mt-eval-harness'})")


def text_line(c: dict) -> str:
    """One terminal line: the harness's head and its message, verbatim."""
    return f"{head(c)}: {_message(c)}"


def markdown_line(c: dict) -> str:
    """The same in Markdown: a major caveat's head in bold."""
    h = head(c)
    return (f"**{h}:** {_message(c)}" if c.get("severity") == "major"
            else f"{h}: {_message(c)}")


def text_lines(caveats: list | None, prefix: str = "") -> list[str]:
    return [prefix + text_line(c) for c in relayed(caveats)]


def markdown_lines(caveats: list | None) -> list[str]:
    return [markdown_line(c) for c in relayed(caveats)]


def short_label(c: dict) -> str:
    """A few words for a list line — the harness's own
    (``score_caveats.short_label``: "100% near-constant output"), else the
    caveat's kind, readable, when this harness has no such function."""
    try:
        from . import _harness

        _harness.load_harness()
        from mt_eval_harness.score_caveats import short_label as _label

        label = _label(c)
        if label:
            return str(label)
    except Exception:   # an older harness: its kind, as it wrote it
        pass
    return str(c.get("kind") or "caveat").replace("_", " ")


#: Said where forge names a score as the one to quote and the harness has a
#: major caveat on it: the caveat goes WITH the number, first.
QUOTE_WITH_CAVEAT = "read this caveat first"
