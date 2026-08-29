"""preregister — predictions written BEFORE results (guards #3, #9).

The catalogued failure chain: the champion model was selected by peeking at
the test set, so "the number to beat" was garbage, and the finding built on
those runs ("eval-loss lies") had to be demoted to an open question. What
kept the reference project honest through that discovery was its habit of
pre-registered predictions — falsifiable, written down, checked in order,
including the ones that were wrong.

forge makes the habit a file format plus a gate:

- ``new()`` writes ``preregistrations/<id>.json`` binding predictions to a
  registered eval set's CONTENT HASH (and optionally a run config hash), and
  ledgers the act.
- ``require_prereg()`` is called by the scoring/comparison renderers for any
  ``test``/``sealed`` set: no matching preregistration → no table. It also
  checks ORDER against the ledger: a preregistration created after the set
  was already read for scoring under the same config is refused — predictions
  written after peeking are not predictions.

Prediction entries are structured when they can be auto-verdicted::

    {"metric": "chrf++", "subset": "overall",
     "direction": "increase" | "decrease" | "no_change",
     "margin": 2.0,                  # points of the metric
     "baseline_score": 43.6,         # the number the direction is against
     "rationale": "recovered vocabulary should lift lexical overlap"}

Free-text predictions (``{"metric": ..., "expect": "...", "rationale": ...}``)
are allowed and rendered for manual verdicts.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from ..errors import PreregistrationInvalid, PreregistrationMissing
from ..workspace import Workspace

PREREG_VERSION = 1
_DIRECTIONS = ("increase", "decrease", "no_change")
_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$")


def _validate_predictions(predictions: list[dict]) -> None:
    if not predictions:
        raise PreregistrationInvalid(
            "a preregistration needs at least one prediction",
            why="an empty prereg is a rubber stamp, not a falsifiable claim",
            fix="state what you expect, per metric, with a rationale",
        )
    for i, p in enumerate(predictions):
        if not p.get("metric"):
            raise PreregistrationInvalid(f"prediction {i}: missing 'metric'")
        if not p.get("rationale", "").strip():
            raise PreregistrationInvalid(
                f"prediction {i}: missing 'rationale'",
                why="a prediction without a why cannot be learned from when "
                    "it fails",
                fix="one sentence on the mechanism you expect",
            )
        d = p.get("direction")
        if d is not None and d not in _DIRECTIONS:
            raise PreregistrationInvalid(
                f"prediction {i}: direction {d!r} not in {_DIRECTIONS}"
            )
        if d is not None and "margin" in p and not isinstance(p["margin"], (int, float)):
            raise PreregistrationInvalid(f"prediction {i}: margin must be numeric")
        if d is None and not p.get("expect"):
            raise PreregistrationInvalid(
                f"prediction {i}: needs either a structured direction or a "
                "free-text 'expect'"
            )


def new(
    workspace: Workspace,
    *,
    prereg_id: str,
    eval_set: str,
    predictions: list[dict],
    author: str = "",
    config_hash: str | None = None,
    consequences: str = "",
    allow_after_reads: bool = False,
) -> Path:
    """Create a preregistration for a registered eval set."""
    if not _ID_RE.match(prereg_id):
        raise PreregistrationInvalid(f"prereg id {prereg_id!r} must be a slug")
    entry = workspace.registry.get(eval_set)
    _validate_predictions(predictions)

    # ordering sanity at creation: has this set already been read for scoring
    # under this config? Then these are postdictions, not predictions.
    prior = [
        e for e in workspace.ledger.find("read", set=eval_set, purpose="score")
        if config_hash is None or e.get("config_hash") in (None, config_hash)
    ]
    if prior and not allow_after_reads:
        raise PreregistrationInvalid(
            f"eval set {eval_set!r} was already read for scoring "
            f"({len(prior)} time(s)) before this preregistration",
            why="predictions written after seeing results are postdictions; "
                "registering them as a prereg would launder adaptive use",
            fix="preregister BEFORE the first scoring read; if this prereg "
                "genuinely predates those reads (e.g. written on paper), pass "
                "allow_after_reads=True — the override is ledgered",
        )
    path = workspace.prereg_dir / f"{prereg_id}.json"
    if path.exists():
        raise PreregistrationInvalid(
            f"preregistration {prereg_id!r} already exists",
            why="editing a prereg after the fact defeats it",
            fix="write a new prereg with a new id; the old one stands as history",
        )
    event = workspace.ledger.append(
        "prereg", prereg_id=prereg_id, set=eval_set,
        sha256=entry["sha256"], config_hash=config_hash,
        after_reads_override=bool(prior),
    )
    if prior:
        workspace.ledger.append(
            "override", set=eval_set, kind="prereg-after-reads",
            prereg_id=prereg_id, reason="allow_after_reads=True",
        )
    doc = {
        "prereg_version": PREREG_VERSION,
        "id": prereg_id,
        "created_utc": event["ts"],
        "author": author,
        "eval_set": {"name": eval_set, "sha256": entry["sha256"]},
        "config_hash": config_hash,
        "predictions": predictions,
        "consequences": consequences,
    }
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8")
    return path


def load(workspace: Workspace, prereg_id: str) -> dict:
    path = workspace.prereg_dir / f"{prereg_id}.json"
    if not path.exists():
        raise PreregistrationMissing(
            f"no preregistration {prereg_id!r}",
            fix="create one: nmt_forge.guards.preregister.new(...) or "
                "`nmt-forge prereg new`",
        )
    return json.loads(path.read_text(encoding="utf-8"))


def find_for(
    workspace: Workspace, eval_set: str, config_hash: str | None = None
) -> list[dict]:
    """Preregs binding this set at its CURRENT content hash (newest last)."""
    entry = workspace.registry.get(eval_set)
    out = []
    for path in sorted(workspace.prereg_dir.glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        es = doc.get("eval_set", {})
        if es.get("name") != eval_set or es.get("sha256") != entry["sha256"]:
            continue
        pinned = doc.get("config_hash")
        if pinned is not None and config_hash is not None and pinned != config_hash:
            continue
        out.append(doc)
    return out


def require_prereg(
    workspace: Workspace, eval_set: str, config_hash: str | None = None
) -> dict:
    """The gate: a valid, ORDER-CORRECT prereg for this set, or refusal."""
    candidates = find_for(workspace, eval_set, config_hash)
    if not candidates:
        raise PreregistrationMissing(
            f"no preregistration for eval set {eval_set!r} at its current "
            "content hash"
            + (f" (config {config_hash})" if config_hash else ""),
            why="results looked at without written-down expectations become "
                "post-hoc stories; the reference project's honest recovery "
                "from its no-valid-baseline moment ran on preregistrations",
            fix="write one FIRST: preregister.new(workspace, prereg_id=..., "
                f"eval_set={eval_set!r}, predictions=[...]) — then score",
        )
    # ordering: the prereg ledger event must precede the first score-purpose
    # read of this set for this config. Ledger ORDER (not timestamps) is the
    # arbiter — the chain fixes the sequence.
    entries = workspace.ledger.entries()
    first_score_read = next(
        (i for i, e in enumerate(entries)
         if e["event"] == "read" and e.get("set") == eval_set
         and e.get("purpose") == "score"
         and (config_hash is None or e.get("config_hash") in (None, config_hash))),
        None,
    )
    valid = []
    for doc in candidates:
        ev_idx = next(
            (i for i, e in enumerate(entries)
             if e["event"] == "prereg" and e.get("prereg_id") == doc["id"]),
            None,
        )
        if ev_idx is None:
            continue  # prereg file without a ledger event — not trusted
        if first_score_read is None or ev_idx < first_score_read:
            valid.append(doc)
    if not valid:
        raise PreregistrationInvalid(
            f"preregistration(s) for {eval_set!r} were created AFTER the set "
            "was already read for scoring under this config",
            why="a prediction written after peeking is a postdiction",
            fix="iterate on a dev-role set; test/sealed sets are for "
                "predictions made in advance",
        )
    return valid[-1]


def check(prereg: dict, scores: dict[str, dict]) -> list[dict]:
    """Render predictions vs observed scores, with auto-verdicts where possible.

    ``scores`` is ``{metric: {"score": float, ...}}`` (a ScoreReport's table).
    Verdicts: held / failed / manual (free-text or no baseline_score).
    """
    rows = []
    for p in prereg["predictions"]:
        metric = p["metric"]
        observed = scores.get(metric, {}).get("score")
        verdict = "manual"
        delta = None
        if observed is not None and p.get("direction") and "baseline_score" in p:
            margin = float(p.get("margin", 0.0))
            delta = observed - float(p["baseline_score"])
            if p["direction"] == "increase":
                verdict = "held" if delta >= margin else "failed"
            elif p["direction"] == "decrease":
                verdict = "held" if delta <= -margin else "failed"
            else:  # no_change
                verdict = "held" if abs(delta) <= margin else "failed"
        rows.append({
            "metric": metric,
            "subset": p.get("subset", "overall"),
            "predicted": p.get("direction") or p.get("expect", ""),
            "margin": p.get("margin"),
            "baseline_score": p.get("baseline_score"),
            "observed": observed,
            "delta": None if delta is None else round(delta, 3),
            "verdict": verdict,
            "rationale": p.get("rationale", ""),
        })
    return rows
