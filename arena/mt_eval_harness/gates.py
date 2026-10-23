"""Gates — per-segment checks between a method's output and what ships.

Founder, 2026-10-10: the engine offers a gate SLOT that people fill with their
own checks; ours are experimental and are not ported in. A gate-chain/1 file
(``shared/schemas/framework/gate-chain.v1.schema.json``) lists gates in
order. A gate of kind ``metric-threshold`` reads one per-segment value from a
metric plugin the harness already loads (an FST validity check, a script
check — the plugin interface the harness's licence exception covers) and
compares it with ``min`` / ``max``.

The first gate that refuses a segment decides what ships instead:
``drop`` (nothing), ``keep-source`` (the source text), ``flag`` (the
output, marked — not counted as refused) or ``fallback`` (the chain's
fallback method translates the segment — a dictionary or a model that runs
in this process, so nothing leaves the machine — and the SAME gates judge
that translation; refused again, nothing ships). A segment the plugin cannot
score is refused: an unjudged segment is never shipped as if it had passed.
A gate whose plugin is not loaded, or a fallback that cannot run here,
stops the run before anything is translated.

What is measured is what ships (founder, 2026-10-10): the report's headline
scores the gated output, the ungated score sits beside it, and the refusal
rate is a number of its own. The chain's fingerprint travels with every
report and published run.
"""

from __future__ import annotations

import math

import hashlib
import json
from pathlib import Path

from mt_eval_harness.framework import SCHEMA_IDS, check_document

GATE_CHAIN_SCHEMA_ID = SCHEMA_IDS["gate-chain"]


class GateError(ValueError):
    """A gate chain that cannot be applied (invalid, or its plugin is missing)."""


def check_gate_chain(doc) -> list[str]:
    """Errors (empty when it holds) for a parsed gate-chain/1 document — the
    framework reader's verdict, the one `champollion validate` gives too."""
    return check_document(doc, "gate-chain")["errors"]


def needs_fallback(chain: dict) -> bool:
    """Whether any gate in the chain hands what it refuses to the fallback."""
    return any(g["on_refuse"] == "fallback" for g in chain["gates"])


def refuse_fallback_in_measurement(chain: dict) -> None:
    """A measurement never blends two methods (founder, 2026-10-11): with a
    fallback, the gated headline would score segments the fallback wrote
    under the method's name. A fallback is for serving and translating —
    where what ships matters — and a chain that uses one is refused by every
    command that scores (run, test). Raises GateError, before anything is
    translated or spent."""
    if not needs_fallback(chain):
        return
    method = (chain.get("fallback") or {}).get("method", "its fallback")
    users = ", ".join(g["id"] for g in chain["gates"] if g["on_refuse"] == "fallback")
    raise GateError(
        f"gate chain {chain['id']}: gate(s) {users} hand refused segments to a fallback "
        f"({method}) — a fallback is for serving and translating, never for a measurement: "
        "the score would be partly this method's and partly the fallback's, under one name. "
        "To measure with these gates, use a chain whose gates drop, keep the source or flag; "
        "to know how the fallback does, measure it as a method of its own")


_FALLBACKS: dict = {}


def make_fallback(chain: dict, source: str, target: str):
    """The chain's fallback method, loaded once per process, or None when no
    gate uses it. Only a method that runs in this process is loaded (the
    rule ``mt-eval serve`` keeps, ``mt_eval_harness.serve.ServedMethod``):
    a fallback never sends a refused segment anywhere. Raises GateError when
    it cannot run here — before anything is translated."""
    fb = chain.get("fallback")
    if not needs_fallback(chain):
        return None
    if not fb:
        raise GateError(f"gate chain {chain['id']}: a gate hands refused segments to the "
                        f"fallback, and the chain names none")
    if not source or not target:
        raise GateError(f"gate chain {chain['id']}: the fallback ({fb['method']}) needs the "
                        f"pair it translates, and none is recorded here (the run's source "
                        f"and target language codes)")
    key = (fb["method"], fb.get("model", ""), source, target)
    if key not in _FALLBACKS:
        from mt_eval_harness.serve import ServeError, ServedMethod
        try:
            _FALLBACKS[key] = ServedMethod(fb["method"], model=fb.get("model", ""),
                                           source=source, target=target)
        except ServeError as exc:
            raise GateError(f"gate chain {chain['id']}: its fallback cannot run here — "
                            f"{exc}") from exc
    return _FALLBACKS[key]


def fallback_mark(fallback) -> dict:
    """The terms a file written from the fallback's translations carries
    (the ``corpus_loader.derived_mark`` vocabulary), or ``{}``: its
    dictionary's or model's local-only mark, and "no model may train on
    this" when its dictionary says so."""
    if fallback is None:
        return {}
    mark: dict = {}
    if getattr(fallback, "output_local_only", None) is True:
        from mt_eval_harness.corpus_loader import LOCAL_ONLY
        mark["transmission"] = LOCAL_ONLY
    ident = getattr(fallback, "identity", None) or {}
    if ident.get("kind") == "file" and ident.get("path"):
        from mt_eval_harness.corpus_loader import read_steward_sidecar
        try:
            terms = (read_steward_sidecar(ident["path"]) or {}).get("terms")
        except ValueError:
            terms = {"training": "not-allowed"}        # an unreadable mark is a mark
        if isinstance(terms, dict) and terms.get("training") == "not-allowed":
            mark["terms"] = {"training": "not-allowed"}
    return mark


def refusal_message(result: dict) -> str:
    """Why nothing ships for a gated result (``shipped_from`` "nothing")."""
    stop = next((v for v in result.get("gate_verdicts") or [] if v["verdict"] == "refuse"), None)
    first = f"refused by gate {stop['gate']} ({stop['reason_code']})" if stop else "refused"
    fb = result.get("fallback")
    if not fb:
        return first
    if fb.get("error"):
        return f"{first}; the fallback could not translate it ({fb['error']})"
    again = next((v for v in fb.get("verdicts") or [] if v["verdict"] == "refuse"), None)
    if again:
        return (f"{first}; the fallback's translation was refused too, by gate "
                f"{again['gate']} ({again['reason_code']})")
    return first


def read_gate_chain(path) -> dict:
    """The gate chain at ``path``, checked; raises GateError with every problem."""
    p = Path(path)
    try:
        doc = json.loads(p.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise GateError(f"{path}: no such gate-chain file") from exc
    except ValueError as exc:
        raise GateError(f"{path}: not JSON ({exc})") from exc
    errors = check_gate_chain(doc)
    if errors:
        raise GateError(f"{p.name} is not a valid gate-chain/1 document: " + "; ".join(errors))
    return doc


def gate_fingerprint(chain: dict) -> str:
    """sha256 of the chain's canonical JSON — the same gates give the same
    fingerprint however the file is formatted."""
    canon = json.dumps(chain, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


def resolve_gate_plugins(chain: dict, plugins: list, *, references: bool = True) -> dict:
    """{gate id: the loaded metric plugin it reads}; a missing one stops the run.

    ``references=False`` (translate, serve: nothing to compare with): a
    plugin that says it cannot judge a segment without one
    (``unjudged_without_references()`` → why) stops it too."""
    by_name = {getattr(p, "name", None): p for p in plugins or []}
    out = {}
    for gate in chain["gates"]:
        plugin = by_name.get(gate["metric"])
        if plugin is None:
            loaded = ", ".join(sorted(n for n in by_name if n)) or "none"
            raise GateError(
                f"gate '{gate['id']}' reads metric plugin '{gate['metric']}', which is not "
                f"loaded here (loaded: {loaded}) — install it, or remove the gate; a gate "
                f"that cannot judge is never treated as passing")
        if getattr(plugin, "available", True) is False:
            raise GateError(
                f"gate '{gate['id']}' reads metric plugin '{gate['metric']}', which cannot "
                f"score here ({getattr(plugin, 'reason', 'not available')}) — a gate that "
                f"cannot judge is never treated as passing")
        why = None if references else getattr(plugin, "unjudged_without_references", lambda: None)()
        if why:
            raise GateError(
                f"gate '{gate['id']}' reads metric plugin '{gate['metric']}', which cannot "
                f"judge a translation without a reference here: {why}")
        out[gate["id"]] = plugin
    return out


def _number(value):
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float)):
        v = float(value)
        # NaN compares false with every threshold and would be ACCEPTED: a
        # metric that measured nothing is "no value", refused like a missing
        # one (found in the release candidate's code review, 2026-10-18)
        return v if math.isfinite(v) else None
    return None


def judge(value, gate: dict) -> tuple[str, str | None]:
    """(verdict, reason_code) for one segment's value against one gate.
    verdict: accept | flag | refuse (flag when the gate's on_refuse is flag)."""
    v = _number(value)
    if v is None:
        code = "no_value"
    elif "min" in gate and v < gate["min"]:
        code = "below_min"
    elif "max" in gate and v > gate["max"]:
        code = "above_max"
    else:
        return "accept", None
    return ("flag" if gate["on_refuse"] == "flag" else "refuse"), code


def _run_chain(entry: dict, chain: dict, gate_plugins: dict) -> tuple[list[dict], dict | None]:
    """Every gate over one segment until the first refusal: (verdicts, the
    refusing gate or None)."""
    verdicts = []
    for gate in chain["gates"]:
        try:
            result = gate_plugins[gate["id"]].compute(entry) or {}
            value = result.get(gate["field"])
            if value is None and result.get("not_applicable") is True:
                # the metric says there is nothing to judge here (a glossary
                # gate on a sentence with no glossary term): accepted, said
                verdict, code = "accept", "not_applicable"
            else:
                verdict, code = judge(value, gate)
        except Exception as exc:          # the plugin failed on this segment
            value, verdict, code = None, ("flag" if gate["on_refuse"] == "flag" else "refuse"), \
                f"plugin_error:{type(exc).__name__}"
        verdicts.append({"gate": gate["id"], "verdict": verdict, "reason_code": code,
                         "value": _number(value)})
        if verdict == "refuse":
            return verdicts, gate                   # the first refusal decides
    return verdicts, None


def _segment(r: dict, text: str) -> dict:
    """What a gate's plugin reads for one segment."""
    return {"id": r.get("id"), "source": r.get("source", ""), "expected": r.get("expected", ""),
            "raw_predicted": text, "predicted": text,
            "segment": r.get("segment", ""), "difficulty": r.get("difficulty", 0)}


def apply_gates(results: list[dict], chain: dict, plugins: list,
                fallback=None) -> tuple[list[dict], dict]:
    """Gate every translated segment. Returns (gated results, summary).

    A gated result keeps every field; ``predicted`` becomes what ships,
    ``raw_predicted`` the method's own output when they differ,
    ``gate_verdicts`` lists each gate's verdict on the method's output
    (numbers and codes — never text) and ``shipped_from`` says what ships:
    method, source, fallback or nothing. A segment handed to the fallback
    also carries ``fallback`` — the same gates' verdicts on the fallback's
    translation, or the fallback's error. Entries with an error are left as
    they are (they are not translations). The summary is the report's
    ``overall.gates`` block; ``refused`` and ``refusal_rate`` count the
    METHOD's output refused, whatever shipped instead.

    ``fallback``: the chain's fallback, loaded (:func:`make_fallback`) —
    required when a gate's on_refuse is fallback.
    """
    gate_plugins = resolve_gate_plugins(chain, plugins)
    if needs_fallback(chain) and fallback is None:
        raise GateError(f"gate chain {chain['id']}: a gate hands refused segments to the "
                        f"fallback, which is not loaded here")
    by_gate = {g["id"]: {"refused": 0, "flagged": 0} for g in chain["gates"]}
    judged = refused = flagged = 0
    out = []
    to_fallback: list[int] = []
    for r in results:
        if r.get("error"):
            out.append(r)
            continue
        judged += 1
        predicted = r.get("predicted", "") or ""
        verdicts, stop = _run_chain(_segment(r, predicted), chain, gate_plugins)
        for v in verdicts:
            if v["verdict"] == "flag":
                by_gate[v["gate"]]["flagged"] += 1
        new = dict(r)
        new["gate_verdicts"] = verdicts
        new["shipped_from"] = "method"
        if stop is not None:
            refused += 1
            by_gate[stop["id"]]["refused"] += 1
            new["raw_predicted"] = predicted
            if stop["on_refuse"] == "keep-source":
                new["predicted"], new["shipped_from"] = r.get("source", "") or "", "source"
            else:                                   # drop — or nothing until the fallback's turn
                new["predicted"], new["shipped_from"] = "", "nothing"
                if stop["on_refuse"] == "fallback":
                    to_fallback.append(len(out))
        elif any(v["verdict"] == "flag" for v in verdicts):
            flagged += 1
        out.append(new)

    fb_counts = {"tried": 0, "shipped": 0, "flagged": 0, "refused": 0, "failed": 0}
    if to_fallback:
        # One call for every refused segment; the same gates judge each
        # translation, and a second refusal ships nothing.
        sources = [out[i].get("source", "") or "" for i in to_fallback]
        fb_counts["tried"] = len(sources)
        try:
            fb_outs = list(fallback.translate(sources))
        except Exception as exc:                    # the fallback failed: nothing ships
            fb_outs = [("", type(exc).__name__)] * len(sources)
        for i, (text, err) in zip(to_fallback, fb_outs):
            new = out[i]
            if err or not (text or "").strip():
                fb_counts["failed"] += 1
                new["fallback"] = {"error": str(err)[:200] if err else "empty translation"}
                continue
            verdicts, stop = _run_chain(_segment(new, text), chain, gate_plugins)
            new["fallback"] = {"verdicts": verdicts}
            if stop is not None:
                fb_counts["refused"] += 1
                continue
            fb_counts["shipped"] += 1
            fb_counts["flagged"] += any(v["verdict"] == "flag" for v in verdicts)
            new["predicted"], new["shipped_from"] = text, "fallback"
    shipped_from = {"method": 0, "source": 0, "fallback": 0, "nothing": 0}
    for r in out:
        if "shipped_from" in r:
            shipped_from[r["shipped_from"]] += 1
    summary = {
        "chain_id": chain["id"],
        "fingerprint": gate_fingerprint(chain),
        "judged": judged,
        "accepted": judged - refused - flagged,
        "flagged": flagged,
        "refused": refused,
        "refusal_rate": round(refused / judged, 4) if judged else None,
        "by_gate": {gid: dict(c, on_refuse=next(g["on_refuse"] for g in chain["gates"] if g["id"] == gid))
                    for gid, c in by_gate.items()},
        "shipped_from": shipped_from,
    }
    if fallback is not None:
        ident = getattr(fallback, "identity", None) or {}
        summary["fallback"] = dict(
            fb_counts, method=getattr(fallback, "label", None),
            model=({k: ident[k] for k in ("id", "kind", "sha256", "entries") if k in ident} or None),
            output_local_only=getattr(fallback, "output_local_only", None))
    return out, summary
