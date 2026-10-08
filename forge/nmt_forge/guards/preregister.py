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

THE PREDICTIONS FILE — one format, documented here and nowhere else (the
CLI help, ``nmt-forge prereg template`` and every refusal render
:data:`PREDICTIONS_FORMAT` below; the docs point at the template command):
a ``.json`` file holding a JSON ARRAY of prediction objects. Markdown, YAML,
a wrapper object, or free prose are refused with an example of the fix.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from ..errors import (PreregistrationAmbiguous, PreregistrationInvalid,
                      PreregistrationMissing)
from ..workspace import Workspace

PREREG_VERSION = 1
_DIRECTIONS = ("increase", "decrease", "no_change")
_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$")

#: The ONE predictions-file format. Rendered verbatim by ``nmt-forge prereg
#: template`` and quoted by every refusal, so the docs never drift from the
#: validator below.
PREDICTIONS_FORMAT = """\
A predictions file is a .json file holding a JSON ARRAY of prediction
objects — nothing else (no Markdown, no wrapper object). Two kinds:

1. STRUCTURED (auto-verdicted by `nmt-forge prereg check`):
   {"metric": "chrf++",            # a scored lane: chrf++, bleu, exact_match,
                                   #   comet, comet-qe, metricx, or a plugin
                                   #   lane like "crk_linter:equivalent_match_rate"
    "direction": "increase",       # increase | decrease | no_change
    "baseline_score": 20.0,        # the number the direction is measured against
    "margin": 2.0,                 # optional: how far past the baseline counts
    "subset": "overall",           # optional
    "rationale": "why you expect this — one sentence on the mechanism"}

2. FREE-TEXT (verdicted by a human):
   {"metric": "chrf++",
    "expect": "between 15 and 25 on the test set",
    "rationale": "why you expect this"}

Every prediction needs "metric" and "rationale". Get a valid starting file
with:  nmt-forge prereg template --out predictions.json
"""

PREDICTIONS_TEMPLATE = [
    {"metric": "chrf++", "direction": "increase", "baseline_score": 0.0,
     "margin": 5.0, "subset": "overall",
     "rationale": "REPLACE: e.g. a model trained on our pairs should beat a "
                  "no-model baseline of 0 by at least 5 chrF++ points"},
    {"metric": "chrf++",
     "expect": "REPLACE: e.g. between 10 and 30 — small data, weak model",
     "rationale": "REPLACE: one sentence on why you expect this range"},
]


def _known_lanes() -> set[str]:
    from .ci_scoring import DEFAULT_METRICS, NEURAL_LANES

    return set(DEFAULT_METRICS) | set(NEURAL_LANES) | {"mixed_convention_rate"}


def _format_fix() -> str:
    return ("write a JSON array of prediction objects — start from "
            "`nmt-forge prereg template --out predictions.json` and edit it. "
            "The format:\n" + PREDICTIONS_FORMAT)


def load_predictions(path) -> list[dict]:
    """Read + validate a predictions file (the ONE format), or refuse with
    the format and the template command — never a raw JSON traceback."""
    path = Path(path)
    if not path.is_file():
        raise PreregistrationInvalid(
            f"predictions file not found: {path}",
            why="a preregistration binds written-down predictions; there is "
                "nothing to bind",
            fix=_format_fix(),
        )
    text = path.read_text(encoding="utf-8")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        kind = ("Markdown/prose" if path.suffix.lower() in (".md", ".txt")
                else "not valid JSON")
        raise PreregistrationInvalid(
            f"{path.name} is {kind} (line {e.lineno}, column {e.colno}: "
            f"{e.msg})",
            why="predictions are checked mechanically against the scores "
                "later — that needs structured JSON, not prose",
            fix=_format_fix(),
        ) from None
    if not isinstance(data, list):
        shape = type(data).__name__
        hint = (" (it is an object with a 'predictions' key — save just that "
                "array)" if isinstance(data, dict) and "predictions" in data
                else "")
        raise PreregistrationInvalid(
            f"{path.name} holds a JSON {shape}, not an array of predictions"
            + hint,
            why="one format, so every tool and agent reads it the same way",
            fix=_format_fix(),
        )
    _validate_predictions(data)
    return data


def _validate_predictions(predictions: list[dict]) -> None:
    if not predictions:
        raise PreregistrationInvalid(
            "a preregistration needs at least one prediction",
            why="an empty prereg is a rubber stamp, not a falsifiable claim",
            fix=_format_fix(),
        )
    known = None
    for i, p in enumerate(predictions):
        if not isinstance(p, dict):
            raise PreregistrationInvalid(
                f"prediction {i} is a {type(p).__name__}, not an object",
                fix=_format_fix())
        metric = p.get("metric")
        if not isinstance(metric, str) or not metric.strip():
            raise PreregistrationInvalid(
                f"prediction {i}: missing 'metric'", fix=_format_fix())
        if ":" not in metric:
            # plugin lanes are "<plugin>:<key>" and only exist at score time;
            # a built-in lane name must be one forge actually scores, or the
            # verdict would silently stay "manual" forever
            known = known or _known_lanes()
            if metric not in known:
                raise PreregistrationInvalid(
                    f"prediction {i}: metric {metric!r} is not a lane forge "
                    f"scores (built-in lanes: {', '.join(sorted(known))}; "
                    "plugin lanes look like 'plugin:key')",
                    why="a prediction about a metric nobody computes can "
                        "never be checked",
                    fix="use the lane name exactly as `nmt-forge score` "
                        "prints it (e.g. 'chrf++', not 'chrF')",
                )
        placeholders = [k for k, v in p.items()
                         if isinstance(v, str) and v.lstrip().startswith("REPLACE")]
        if placeholders:
            raise PreregistrationInvalid(
                f"prediction {i}: {', '.join(placeholders)} still "
                f"{'holds' if len(placeholders) == 1 else 'hold'} the "
                "template's REPLACE text",
                why="an unedited template predicts nothing — it is the "
                    "rubber stamp preregistration exists to prevent",
                fix="write your own expectation and rationale in those "
                    "fields (and set baseline_score to the number you are "
                    "really comparing against), or delete the prediction",
            )
        if not str(p.get("rationale", "")).strip():
            raise PreregistrationInvalid(
                f"prediction {i}: missing 'rationale'",
                why="a prediction without a why cannot be learned from when "
                    "it fails",
                fix="one sentence on the mechanism you expect",
            )
        d = p.get("direction")
        if d is not None and d not in _DIRECTIONS:
            raise PreregistrationInvalid(
                f"prediction {i}: direction {d!r} not in {_DIRECTIONS}",
                fix=_format_fix())
        for num in ("margin", "baseline_score"):
            if num in p and (isinstance(p[num], bool)
                             or not isinstance(p[num], (int, float))):
                raise PreregistrationInvalid(
                    f"prediction {i}: {num} must be a number, got "
                    f"{p[num]!r}", fix=_format_fix())
        if d is None and not str(p.get("expect", "")).strip():
            raise PreregistrationInvalid(
                f"prediction {i}: needs either a structured direction or a "
                "free-text 'expect'", fix=_format_fix())


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
    # reads the harness made of the same file (mt-eval run / compare) never
    # reach forge's ledger; the read log beside the file records them
    outside = workspace.registry.harness_reads(eval_set)
    outside_n = outside["reads"]
    if (prior or outside_n) and not allow_after_reads:
        parts = ([f"{len(prior)}× by nmt-forge"] if prior else []) + (
            [f"{outside_n}× by mt-eval ("
             + ", ".join(f"{p}" for p in sorted(outside["by_purpose"]))
             + f"; recorded in {outside['log']})"] if outside_n else [])
        raise PreregistrationInvalid(
            f"eval set {eval_set!r} was already read for scoring "
            f"({len(prior) + outside_n} time(s): {', '.join(parts)}) before "
            "this preregistration",
            why="predictions written after seeing results are postdictions; "
                "registering them as a prereg would launder adaptive use",
            fix="preregister BEFORE the first scoring read; if this prereg "
                "genuinely predates those reads (e.g. written on paper), add "
                "--allow-after-reads to `nmt-forge prereg new` (MCP: "
                "forge_prereg with allow_after_reads: true) — the override is "
                "ledgered",
        )
    path = workspace.prereg_dir / f"{prereg_id}.json"
    if path.exists():
        raise PreregistrationInvalid(
            f"preregistration {prereg_id!r} already exists",
            why="editing a prereg after the fact defeats it",
            fix="write a new prereg with a new id; the old one stands as history",
        )
    # runs of this content made before forge registered the set: not in the
    # read log, so never a refusal (by design) — but recorded beside it
    before_reg = len(outside.get("before_registration") or [])
    event = workspace.ledger.append(
        "prereg", prereg_id=prereg_id, set=eval_set,
        sha256=entry["sha256"], config_hash=config_hash,
        after_reads_override=bool(prior or outside_n),
        # how many scored reads came first (the override's size): said
        # wherever the prereg's verdict is shown (after_reads_info)
        **({"forge_score_reads_before": len(prior)} if prior else {}),
        **({"harness_reads_before": outside_n} if outside_n else {}),
        **({"reads_before_registration": before_reg} if before_reg else {}),
    )
    if prior or outside_n:
        workspace.ledger.append(
            "override", set=eval_set, kind="prereg-after-reads",
            prereg_id=prereg_id, reason="allow_after_reads=True",
            **({"harness_reads": outside_n} if outside_n else {}),
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


def after_reads_info(workspace: Workspace, prereg_id: str | None
                     ) -> dict | None:
    """When a preregistration was written AFTER scoring reads of its set
    (the ``--allow-after-reads`` override), what came before it, read from
    the hash-chained ledger: ``{set, reads, forge_reads, mt_eval_reads, ts,
    text}``. None for a prereg written before any scoring read (or an
    unknown id).

    Round 9 school persona: the override was visible only in `nmt-forge
    ledger show` ("overrides: 2") — the report, DEPLOY.md and status showed
    the verdicts as if the predictions were blind. ``text`` is the one
    sentence every surface that shows the prereg's verdict prints."""
    if not prereg_id:
        return None
    entries = workspace.ledger.entries()
    found = next(((i, e) for i, e in enumerate(entries)
                  if e.get("event") == "prereg"
                  and e.get("prereg_id") == prereg_id), None)
    if found is None or not found[1].get("after_reads_override"):
        return None
    idx, ev = found
    eval_set = ev.get("set")
    forge_n = ev.get("forge_score_reads_before")
    if forge_n is None:
        # a ledger row written before the count was recorded: the chain
        # fixes the order, so the reads before the prereg event are counted
        # exactly as `prereg new` counted them
        cfg = ev.get("config_hash")
        forge_n = sum(1 for e in entries[:idx]
                      if e.get("event") == "read" and e.get("set") == eval_set
                      and e.get("purpose") == "score"
                      and (cfg is None or e.get("config_hash") in (None, cfg)))
    mt_n = int(ev.get("harness_reads_before") or 0)
    n = int(forge_n) + mt_n
    parts = ([f"{forge_n}× by nmt-forge"] if forge_n else []) + (
        [f"{mt_n}× by mt-eval"] if mt_n else [])
    text = (f"preregistration {prereg_id} was written AFTER {n} scoring "
            f"read(s) of {eval_set!r} ({', '.join(parts) or 'reads recorded'})"
            ", under the --allow-after-reads override — its predictions are "
            "not blind: whoever wrote them may have seen those scores")
    return {"set": eval_set, "reads": n, "forge_reads": int(forge_n),
            "mt_eval_reads": mt_n, "ts": ev.get("ts"), "text": text}


def load(workspace: Workspace, prereg_id: str) -> dict:
    path = workspace.prereg_dir / f"{prereg_id}.json"
    if not path.exists():
        raise PreregistrationMissing(
            f"no preregistration {prereg_id!r}",
            fix="create one: `nmt-forge prereg new <id> --eval-set <set> "
                "--predictions <file>` (MCP: forge_prereg); list them with "
                "`nmt-forge status`",
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
    workspace: Workspace, eval_set: str, config_hash: str | None = None,
    prereg_id: str | None = None,
) -> dict:
    """The gate: a valid, ORDER-CORRECT prereg for this set AND this run, or
    refusal.

    A prereg binds a test SET, so two runs on one set can each have one
    (Round 5 school persona: a full model and a twin-free model, two
    preregs). The prereg a run is judged against is, in order:

    1. ``prereg_id``: the user's explicit choice (``--prereg`` / MCP
       ``prereg``), refused unless it is a valid binding for this run;
    2. the only valid one;
    3. the one this run's first scored read was admitted under (the ledger
       records it), so a re-evaluation keeps its binding;
    4. the one pinned to this run's config hash (``prereg new --config-hash``).

    Anything else is AMBIGUOUS and refused. It used to take the newest, so
    the full model's DEPLOY.md carried the verdict of the twin-free model's
    predictions.
    """
    if prereg_id is not None:
        load(workspace, prereg_id)            # refuses an unknown id
    candidates = find_for(workspace, eval_set, config_hash)
    if not candidates:
        raise PreregistrationMissing(
            f"no preregistration for eval set {eval_set!r} at its current "
            "content hash"
            + (f" (config {config_hash})" if config_hash else ""),
            why="results looked at without written-down expectations become "
                "post-hoc stories; the reference project's honest recovery "
                "from its no-valid-baseline moment ran on preregistrations",
            fix="write one FIRST: `nmt-forge prereg template --out "
                "predictions.json`, edit it, then `nmt-forge prereg new <id> "
                f"--eval-set {eval_set} --predictions predictions.json` — "
                "then score",
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
    if prereg_id is not None:
        chosen = next((d for d in valid if d["id"] == prereg_id), None)
        if chosen is None:
            why = _why_not_binding(workspace, prereg_id, eval_set, config_hash,
                                   candidates)
            raise PreregistrationInvalid(
                f"preregistration {prereg_id!r} does not bind this run of "
                f"{eval_set!r}: {why}",
                why="a run is judged only against predictions written for "
                    "it, before its test set was read",
                fix=_choose_fix(eval_set, [d["id"] for d in valid]))
        return {**chosen, "bound_by": "named with --prereg"}
    if not valid:
        raise PreregistrationInvalid(
            f"preregistration(s) for {eval_set!r} were created AFTER the set "
            "was already read for scoring under this config",
            why="a prediction written after peeking is a postdiction",
            fix="iterate on a dev-role set; test/sealed sets are for "
                "predictions made in advance",
        )
    if len(valid) == 1:
        return {**valid[0], "bound_by": "the only preregistration valid for "
                                         "this run"}
    if first_score_read is not None:
        bound = entries[first_score_read].get("prereg_id")
        hit = next((d for d in valid if d["id"] == bound), None)
        if hit is not None:
            return {**hit, "bound_by": "the prereg this run's first test read "
                                       "was admitted under"}
    pinned = [d for d in valid
              if config_hash is not None and d.get("config_hash") == config_hash]
    if len(pinned) == 1:
        return {**pinned[0], "bound_by": "pinned to this run's config hash"}
    ids = [d["id"] for d in valid]
    raise PreregistrationAmbiguous(
        f"{len(ids)} preregistrations bind {eval_set!r} for this run "
        f"({', '.join(ids)}) and nothing says which one predicted it",
        why="a prereg binds a test SET, so two runs on one set can each have "
            "one; judging this run against the newest would hand it another "
            "run's predictions (and write that verdict into DEPLOY.md)",
        fix=_choose_fix(eval_set, ids))


def run_binding(workspace: Workspace, eval_set: str,
                config_hash: str | None) -> dict:
    """Which preregistration a run (its config hash) is judged against on
    ``eval_set`` — said in status and the run report, so two preregs on one
    test set never leave the user guessing which applies to which run
    (Round 7). Content-free ``{state, id, how, candidates}``:

    - ``judged``: the run's first scored read was admitted under ``id``;
    - ``would-bind``: not scored yet; :func:`require_prereg` would pick
      ``id`` (``how`` says why — the only valid one, or pinned to the hash);
    - ``ambiguous``: several bind and nothing says which — export refuses
      until one is named with ``--prereg``;
    - ``none``: no valid preregistration for this run yet.
    """
    for e in workspace.ledger.entries():
        if (e.get("event") == "read" and e.get("set") == eval_set
                and e.get("purpose") == "score" and e.get("prereg_id")
                and config_hash is not None
                and e.get("config_hash") == config_hash):
            return {"state": "judged", "id": e["prereg_id"],
                    "how": "its test score was judged against it",
                    "candidates": [e["prereg_id"]]}
    try:
        doc = require_prereg(workspace, eval_set, config_hash)
    except PreregistrationAmbiguous:
        ids = [d["id"] for d in find_for(workspace, eval_set, config_hash)]
        return {"state": "ambiguous", "id": None,
                "how": (f"{len(ids)} preregistrations bind {eval_set!r} and "
                        "nothing says which predicted this run — name one "
                        f"with --prereg on export ({', '.join(ids)})"),
                "candidates": ids}
    except (PreregistrationMissing, PreregistrationInvalid) as e:
        return {"state": "none", "id": None,
                "how": str(e).splitlines()[0].replace("[preregister] ", ""),
                "candidates": []}
    return {"state": "would-bind", "id": doc["id"],
            "how": f"not scored yet; {doc['bound_by']}",
            "candidates": [doc["id"]]}


def _choose_fix(eval_set: str, ids: list[str]) -> str:
    one = ids[0] if ids else "<id>"
    return (f"name the prereg this run was predicted by: `--prereg {one}` on "
            "`nmt-forge export` / `evaluate` / `score` (MCP: forge_export / "
            f"forge_evaluate with prereg: \"{one}\")"
            + (f"; candidates: {', '.join(ids)}" if ids else "")
            + ". Or pin each prereg to its run when you write it: `nmt-forge "
              f"prereg new <id> --eval-set {eval_set} --predictions <file> "
              "--config-hash <hash>` — the full config hash `nmt-forge "
              "preflight run --config <its config>` prints (any later edit "
              "of that config changes it)")


def _why_not_binding(workspace, prereg_id, eval_set, config_hash,
                     candidates) -> str:
    doc = load(workspace, prereg_id)
    es = doc.get("eval_set") or {}
    if es.get("name") != eval_set:
        return f"it predicts eval set {es.get('name')!r}"
    if prereg_id not in {d["id"] for d in candidates}:
        pinned = doc.get("config_hash")
        if pinned and config_hash and pinned != config_hash:
            return f"it is pinned to run config {pinned}, not {config_hash}"
        return ("it was written for an earlier content of the set (the set "
                "was rotated since)")
    return ("it was written AFTER this run's first scored read of the set "
            "(a postdiction for this run)")


def _ci(s: dict) -> list | None:
    if "ci_lower" in s and "ci_upper" in s:
        return [s["ci_lower"], s["ci_upper"]]
    return None


def check(prereg: dict, scores: dict[str, dict] | None = None, *,
          subsets: dict[str, dict] | None = None) -> list[dict]:
    """Render predictions vs observed scores, with auto-verdicts where possible.

    ``scores`` is ``{metric: {"score": float, ...}}`` (a ScoreReport's
    table), used for every prediction; or pass ``subsets`` —
    ``{subset: {metric: {...}}}`` from :func:`scores_by_subset` — and each
    prediction is read against ITS subset (default ``overall``).
    Verdicts: held / failed / manual (free-text or no baseline_score). A
    prediction whose metric or subset the results do not carry says so in
    ``note`` — never a silent ``observed None``.
    """
    rows = []
    for p in prereg["predictions"]:
        metric = p["metric"]
        subset = p.get("subset", "overall")
        note = None
        if subsets is not None:
            table = subsets.get(subset)
            if table is None:
                note = (f"subset {subset!r} is not in these results "
                        f"(they carry: {', '.join(sorted(subsets)) or 'none'})")
                table = {}
        else:
            table = scores or {}
        entry = table.get(metric) or {}
        observed = entry.get("score")
        if observed is None and note is None:
            note = (f"metric {metric!r} was not scored in these results "
                    f"(scored: {', '.join(sorted(table)) or 'none'})")
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
        elif observed is not None and note is None:
            note = ("free-text prediction — a human compares it with the "
                    "observed score" if not p.get("direction") else
                    "no baseline_score — a human compares it with the "
                    "observed score")
        rows.append({
            # 1-based, as `prereg check` prints it and `prereg verdict
            # --prediction <n>` takes it
            "number": len(rows) + 1,
            **({"id": p["id"]} if p.get("id") is not None else {}),
            "metric": metric,
            "subset": subset,
            "predicted": p.get("direction") or p.get("expect", ""),
            "margin": p.get("margin"),
            "baseline_score": p.get("baseline_score"),
            "observed": observed,
            "observed_ci": _ci(entry),
            "delta": None if delta is None else round(delta, 3),
            "verdict": verdict,
            "rationale": p.get("rationale", ""),
            "note": note,
            # a person's recorded judgment (attach_human_verdicts) — never
            # folded into `verdict`, which stays what forge computed
            "human_verdict": None,
        })
    return rows


# -- human verdicts -----------------------------------------------------------

#: The ledger event a person's verdict on a prediction is written as.
VERDICT_EVENT = "prereg-verdict"
HUMAN_VERDICTS = ("held", "missed")


def _prediction_index(prereg: dict, prediction) -> int:
    """0-based index of ``prediction``: a 1-based number as `prereg check`
    prints it, or a prediction's own ``id``."""
    preds = prereg["predictions"]
    s = str(prediction).strip()
    if s.isdigit():
        n = int(s)
        if 1 <= n <= len(preds):
            return n - 1
        raise PreregistrationInvalid(
            f"prereg {prereg['id']!r} has {len(preds)} prediction(s); "
            f"there is no #{n}",
            fix=f"pass --prediction 1…{len(preds)} as `nmt-forge prereg "
                f"check {prereg['id']}` numbers them")
    hits = [i for i, p in enumerate(preds) if str(p.get("id", "")) == s]
    if len(hits) == 1:
        return hits[0]
    raise PreregistrationInvalid(
        f"prereg {prereg['id']!r}: no prediction with id {s!r}",
        fix=f"pass the number `nmt-forge prereg check {prereg['id']}` "
            "prints (#1, #2, …)")


def _prediction_sha(p: dict) -> str:
    return hashlib.sha256(json.dumps(p, sort_keys=True, ensure_ascii=False)
                          .encode("utf-8")).hexdigest()[:16]


def human_verdicts(workspace: Workspace, prereg_id: str) -> dict[int, dict]:
    """``{0-based prediction index: the latest recorded human verdict}``,
    read from the ledger (each record: verdict, by, by_source, note, ts,
    ledger entry hash, and how many earlier verdicts it revised)."""
    out: dict[int, dict] = {}
    for e in workspace.ledger.find(VERDICT_EVENT, prereg_id=prereg_id):
        idx = e.get("prediction_index")
        if not isinstance(idx, int):
            continue
        prev = out.get(idx)
        out[idx] = {"verdict": e.get("verdict"), "by": e.get("by"),
                    "by_source": e.get("by_source"), "note": e.get("note"),
                    "ts": e.get("ts"), "ledger_entry": e.get("entry_hash"),
                    "prediction_sha": e.get("prediction_sha"),
                    "revises": (prev["revises"] + 1) if prev else 0}
    return out


def attach_human_verdicts(workspace: Workspace, prereg_id: str,
                          rows: list[dict]) -> list[dict]:
    """Copy of ``rows`` (from :func:`check`) with each prediction's recorded
    human verdict under ``human_verdict``; ``verdict`` is left as forge
    computed it."""
    found = human_verdicts(workspace, prereg_id)
    return [{**r, "human_verdict": found.get(r.get("number", 0) - 1)}
            for r in rows]


def verdict_counts(rows: list[dict]) -> dict:
    """``{held, failed, manual, human_held, human_missed, unjudged}`` —
    computed verdicts and human ones counted apart, never merged."""
    c = {v: sum(r.get("verdict") == v for r in rows)
         for v in ("held", "failed", "manual")}
    hv = [r.get("human_verdict") for r in rows if r.get("verdict") == "manual"]
    c["human_held"] = sum(1 for h in hv if h and h.get("verdict") == "held")
    c["human_missed"] = sum(1 for h in hv
                            if h and h.get("verdict") == "missed")
    c["unjudged"] = c["manual"] - c["human_held"] - c["human_missed"]
    return c


def counts_text(c: dict) -> str:
    """One line for :func:`verdict_counts` — computed and human apart."""
    unjudged = c.get("unjudged", c["manual"])
    text = (f"{c['held']} held, {c['failed']} failed, {unjudged} for a "
            "human to judge")
    judged = c.get("human_held", 0) + c.get("human_missed", 0)
    if judged:
        text += (f"; {judged} judged by a human (recorded verdicts, not "
                 f"computed): {c['human_held']} held, {c['human_missed']} "
                 "missed")
    return text


def record_verdict(workspace: Workspace, prereg_id: str, prediction,
                   verdict: str, *, by: str, by_source: str = "--by",
                   note: str = "", revise: bool = False) -> dict:
    """Ledger a PERSON's verdict on one prediction forge cannot verdict
    itself (free-text, or structured without a baseline_score).

    Refused for a prediction forge verdicts (its computed verdict is the
    record), before any result was judged against this prereg (there is
    nothing to compare yet), and — without ``revise`` — when a verdict is
    already recorded (a changed verdict is a new, visible ledger entry,
    never a quiet edit). The ledger's hash chain makes the record
    tamper-evident (``nmt-forge ledger verify``)."""
    if verdict not in HUMAN_VERDICTS:
        raise PreregistrationInvalid(
            f"verdict {verdict!r} must be one of {HUMAN_VERDICTS}")
    if not str(by or "").strip():
        raise PreregistrationInvalid(
            "a human verdict needs who made it",
            fix="pass --by \"<name or role>\" (MCP: by)")
    prereg = load(workspace, prereg_id)
    idx = _prediction_index(prereg, prediction)
    p = prereg["predictions"][idx]
    if p.get("direction") and "baseline_score" in p:
        raise PreregistrationInvalid(
            f"prediction #{idx + 1} of {prereg_id!r} is structured "
            f"({p['direction']} vs baseline {p['baseline_score']}): forge "
            "verdicts it from the scores",
            why="a computed verdict is the record; a human verdict beside it "
                "would make two answers to one question",
            fix=f"read it with `nmt-forge prereg check {prereg_id}`; human "
                "verdicts are for free-text predictions (and structured ones "
                "without a baseline_score)")
    eval_set = (prereg.get("eval_set") or {}).get("name")
    reads = [e for e in workspace.ledger.find("read", set=eval_set,
                                              purpose="score")
             if e.get("prereg_id") in (None, prereg_id)]
    if not reads:
        raise PreregistrationInvalid(
            f"no result has been judged against prereg {prereg_id!r} yet "
            f"(no scored read of {eval_set!r})",
            why="a verdict compares the prediction with an observed score — "
                "there is none yet",
            fix=f"score the test set first (nmt-forge export <run-manifest> "
                f"--out <dir> --prereg {prereg_id}), read the observed score "
                f"with `nmt-forge prereg check {prereg_id}`, then record the "
                "verdict")
    existing = human_verdicts(workspace, prereg_id).get(idx)
    if existing and not revise:
        raise PreregistrationInvalid(
            f"prediction #{idx + 1} of {prereg_id!r} already has a human "
            f"verdict: {existing['verdict'].upper()} by {existing['by']} "
            f"({existing['ts']})",
            why="a verdict is a record; changing it must be visible",
            fix="pass --revise to record a new verdict (both stay in the "
                "ledger; the newest is shown)")
    entry = workspace.ledger.append(
        VERDICT_EVENT, prereg_id=prereg_id, set=eval_set,
        prediction_index=idx, prediction_number=idx + 1,
        prediction_id=p.get("id"), prediction_sha=_prediction_sha(p),
        metric=p.get("metric"), verdict=verdict, by=str(by).strip(),
        by_source=by_source, note=note or "",
        revises=bool(existing))
    return {"prereg_id": prereg_id, "prediction": idx + 1,
            "prediction_id": p.get("id"), "metric": p.get("metric"),
            "expected": p.get("expect") or p.get("direction"),
            "verdict": verdict, "by": entry["by"], "by_source": by_source,
            "note": entry["note"], "ts": entry["ts"],
            "ledger_entry": entry["entry_hash"],
            "revised": existing}


# harness TestReport overall keys → forge lane names (the SAME computations:
# forge delegates every metric to the harness)
_TESTREPORT_LANES = {"chrf++": ("corpus_chrf", "corpus_chrf"),
                     "bleu": ("corpus_bleu", "corpus_bleu"),
                     "exact_match": ("exact_match_rate", "exact_match_rate")}

RESULTS_SHAPES = (
    "an export directory (or its model/ directory, or its forge-model.json), "
    "the battery manifest `export`/`evaluate` write "
    "(evaluation/battery-hyps-battery.json), a ScoreReport "
    "(`nmt-forge score --json-out`), or the mt-eval TestReport `export` "
    "writes (evaluation/runlog_report.json)")


def scores_by_subset(doc: dict) -> dict[str, dict]:
    """The score tables a results document carries, keyed by the
    prediction ``subset`` they answer: ``overall``; for a battery also each
    group, ``<group> (strict)`` and ``strict`` (the clean subset — rows with
    no train-side near-twin). Raises ValueError for an unknown shape."""
    if doc.get("guard") == "ci-scoring/battery":
        groups = doc.get("groups") or {}
        out: dict[str, dict] = {}
        for g, rep in groups.items():
            out[g] = rep.get("scores") or {}
        for g, rep in (doc.get("strict_groups") or {}).items():
            out[f"{g} (strict)"] = rep.get("scores") or {}
        if len(groups) == 1:
            out["overall"] = next(iter(groups.values())).get("scores") or {}
            strict = next(iter((doc.get("strict_groups") or {}).values()),
                          None)
        else:
            out["overall"] = {
                m: {"score": v,
                    "note": "weighted mean across groups (no CI)"}
                for m, v in (doc.get("weighted") or {}).items()
                if isinstance(v, (int, float)) and not isinstance(v, bool)}
            strict = None
        strict = doc.get("strict_overall") or strict
        if strict:
            out["strict"] = strict.get("scores") or {}
        return out
    if isinstance(doc.get("scores"), dict):          # ScoreReport manifest
        return {"overall": doc["scores"]}
    overall = doc.get("overall")
    if isinstance(overall, dict) and "corpus_chrf" in overall:  # TestReport
        cis = overall.get("confidence_intervals") or {}
        table = {}
        for lane, (key, ci_key) in _TESTREPORT_LANES.items():
            if overall.get(key) is None:
                continue
            ci = cis.get(ci_key) or {}
            table[lane] = {"score": ci.get("score", overall[key]),
                           **({"ci_lower": ci["ci_lower"],
                               "ci_upper": ci["ci_upper"]}
                              if "ci_lower" in ci else {})}
        return {"overall": table}
    if doc and all(isinstance(v, dict) and "score" in v
                   for v in doc.values()):          # a bare {metric: {...}}
        return {"overall": doc}
    raise ValueError(f"not a results document forge can read — expected "
                     f"{RESULTS_SHAPES}")


def results_eval_set(doc: dict) -> str | None:
    """The eval set a results document scored (None when it does not say)."""
    if doc.get("guard") in ("ci-scoring/battery", "ci-scoring"):
        name = doc.get("eval_set")
        return str(name).split(":")[0] if name else None
    # an mt-eval TestReport forge wrote carries forge's set name in
    # `overall` (its config.dataset_id is the id mt-eval knows the set by)
    forge_set = (doc.get("overall") or {}).get("nmt_forge_set") \
        if isinstance(doc.get("overall"), dict) else None
    if forge_set:
        return str(forge_set)
    cfg = doc.get("config") or {}
    return cfg.get("dataset_id") if isinstance(cfg, dict) else None


def load_results(path) -> tuple[dict, Path]:
    """Read ``--results``: a results file, or an export directory / its
    model directory / forge-model.json (→ its battery manifest, resolved
    relative to the forge-model.json — any export layout). Returns
    ``(doc, file)``; raises ValueError naming the accepted shapes
    otherwise."""
    from ..export import find_forge_model

    p = Path(path)
    if p.is_dir():
        fm = find_forge_model(p)
        if fm is None:
            raise ValueError(f"{p} is a directory without forge-model.json "
                             f"— expected {RESULTS_SHAPES}")
        p = fm
    try:
        doc = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise ValueError(f"{p}: not a readable JSON results file ({e}) — "
                         f"expected {RESULTS_SHAPES}") from None
    if isinstance(doc, dict) and str(doc.get("format", "")).startswith(
            "nmt-forge-model/"):
        tr = doc.get("test_report") or {}
        battery = tr.get("battery_manifest")
        if not battery:
            raise ValueError(
                f"{p}: this export carries no test-set evaluation (exported "
                "with --no-eval) — there is nothing to check predictions "
                "against")
        p = p.parent / battery
        try:
            doc = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            raise ValueError(f"{p}: the export's battery manifest is not "
                             f"readable ({e})") from None
    if not isinstance(doc, dict):
        raise ValueError(f"{p}: holds a JSON {type(doc).__name__} — "
                         f"expected {RESULTS_SHAPES}")
    scores_by_subset(doc)       # shape check: raises with the accepted list
    return doc, p
