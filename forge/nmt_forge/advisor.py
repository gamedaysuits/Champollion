"""advisor — the stateful next-action driver (agent-first UX).

The static NEXT_STEPS.md tells an agent the generic recipe; this module
reads the ACTUAL workspace (registry roles, preregistrations, runs, ledger)
and answers the two questions a driving agent needs answered mechanically:

    nmt-forge status      where am I? (state table + THE next command)
    nmt-forge preflight X will command X refuse? (every gate, ✓/✗, with fixes)

Design rules:
  * Deterministic: same workspace state → same advice. No cleverness.
  * Every suggestion is an exact command string (placeholders in <angle
    brackets> only where the value is genuinely the user's, e.g. file paths).
  * ``--json`` output for agents; human rendering for terminals.
  * The advisor never mutates anything and never reads corpus content.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .workspace import Workspace


# -- state snapshot -----------------------------------------------------------

def snapshot(ws: Workspace) -> dict:
    """Content-free picture of the workspace: what exists, what's missing."""
    roles: dict[str, list[str]] = {"dev": [], "test": [], "sealed": []}
    for role in roles:
        try:
            roles[role] = ws.registry.names(roles=(role,))
        except Exception:
            roles[role] = []

    preregs = []
    for f in sorted(ws.prereg_dir.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            ev = data.get("eval_set") or data.get("eval") or ""
            if isinstance(ev, dict):          # prereg v1: {"name":…, "sha256":…}
                ev = ev.get("name", "")
            preregs.append({"id": f.stem, "eval": str(ev)})
        except Exception:
            preregs.append({"id": f.stem, "eval": "(unreadable)"})

    runs = []
    for d in sorted(ws.runs_dir.iterdir()) if ws.runs_dir.exists() else []:
        if not d.is_dir():
            continue
        # `nmt-forge run` writes run-manifest.json; accept the bare name too
        man = d / "run-manifest.json"
        if not man.is_file():
            man = d / "manifest.json"
        if man.is_file():
            try:
                m = json.loads(man.read_text())
                runs.append({
                    "run": m.get("run_name", d.name),
                    "config_hash": m.get("config_hash", ""),
                    "selected_checkpoint": m.get("selected_checkpoint"),
                    "manifest": str(man),
                })
            except Exception:
                runs.append({"run": d.name, "manifest": str(man),
                             "config_hash": "", "selected_checkpoint": None})

    events: dict[str, int] = {}
    try:
        for e in ws.ledger.entries():
            events[e.get("event", "?")] = events.get(e.get("event", "?"), 0) + 1
    except Exception:
        pass

    return {"workspace": str(ws.root), "roles": roles, "preregs": preregs,
            "runs": runs, "ledger_events": events}


# -- next action --------------------------------------------------------------

@dataclass
class Advice:
    state: str                    # short name of the detected state
    command: str                  # THE next command, exact
    why: str
    ready: list[str] = field(default_factory=list)   # ✓ items
    blockers: list[str] = field(default_factory=list)

    def to_json(self) -> dict:
        return {"state": self.state, "next_command": self.command,
                "why": self.why, "ready": self.ready,
                "blockers": self.blockers}


def next_action(ws: Workspace) -> Advice:
    """The decision ladder. Ordered: each rung assumes the previous ones."""
    s = snapshot(ws)
    ready: list[str] = []
    dev, test, sealed = s["roles"]["dev"], s["roles"]["test"], s["roles"]["sealed"]

    if not (dev or test or sealed):
        return Advice(
            state="empty-workspace",
            command="nmt-forge discover <iso639-3>   # then: nmt-forge init "
                    "<iso639-3>; if you ALREADY have a parallel corpus, go "
                    "straight to: nmt-forge split <corpus.jsonl> --dev <N> "
                    "--test <M> --seed <S> --out data/splits --register mypair",
            why="no eval sets are registered — start by discovering what "
                "assets exist for your language, then init a project "
                "(init writes NEXT_STEPS.md and the language block). If you "
                "already have parallel data, the concrete next move is a "
                "group-disjoint split that registers a dev AND a test set in "
                "one step (--register)",
            blockers=["no dev/test/sealed sets registered"],
        )
    if test:
        ready.append(f"test set(s) registered: {', '.join(test)}")
    if sealed:
        ready.append(f"sealed set(s) registered: {', '.join(sealed)}")

    if not dev:
        return Advice(
            state="no-dev-set",
            command="nmt-forge split <your-parallel-corpus.jsonl> "
                    "--out-dir data/splits   # then registry add the dev file",
            why="checkpoint selection needs a fenced dev set (role=dev); the "
                "split-guard carves train/dev/test group-disjointly so "
                "answer-sharing rows can never straddle the split",
            ready=ready,
            blockers=["no dev set registered — training will be refused by "
                      "the dev-fence"],
        )
    ready.append(f"dev set registered: {', '.join(dev)}")

    prereg_evals = {p["eval"] for p in s["preregs"] if p["eval"]}
    unpreregged = [t for t in test + sealed if t not in prereg_evals]
    if unpreregged:
        name = unpreregged[0]
        return Advice(
            state="missing-preregistration",
            command=f"nmt-forge prereg new --eval {name} "
                    f"--predictions <predictions.md>",
            why="scoring a test/sealed set is refused without a "
                "preregistration (predictions written BEFORE results); "
                f"{name!r} has none",
            ready=ready,
            blockers=[f"no preregistration bound to {name!r}"],
        )
    if prereg_evals:
        ready.append(f"preregistration(s): {', '.join(sorted(prereg_evals))}")

    if not s["runs"]:
        return Advice(
            state="ready-to-train",
            command="nmt-forge run <config.json>",
            why="evals are registered, dev is fenced, predictions are "
                "preregistered — train through the guarded loop (leak-audit, "
                "schedule floor, checkpoint selection all run inside)",
            ready=ready,
        )
    last = s["runs"][-1]
    ready.append(f"run complete: {last['run']} "
                 f"(checkpoint: {last.get('selected_checkpoint') or 'see manifest'})")
    return Advice(
        state="ready-to-score",
        command=f"nmt-forge evaluate {last['manifest']} --config <config.json>",
        why="a trained run exists — `evaluate` decodes your battery with the "
            "selected checkpoint, scores it (prereg-gated, CI'd) and appends "
            "the Diagnosis & Recommendations, all in one step (no manual "
            "decode or checkpoint symlink)",
        ready=ready,
    )


# -- preflight ----------------------------------------------------------------

@dataclass
class Gate:
    name: str
    ok: bool
    detail: str
    fix: str = ""

    def to_json(self) -> dict:
        return {"gate": self.name, "ok": self.ok, "detail": self.detail,
                "fix": self.fix}


_KNOWN = ("run", "score", "split", "prereg", "leak-audit")


def preflight(ws: Workspace, command: str) -> list[Gate]:
    """Every gate ``command`` will hit, evaluated against workspace state.

    Deliberately conservative: gates that depend on runtime arguments
    (file paths, config contents) are reported as informational with the
    check they will trigger, so the agent knows what is COMING even when it
    can't be verified yet.
    """
    if command not in _KNOWN:
        return [Gate("known-command", False,
                     f"{command!r} has no preflight profile",
                     fix=f"one of: {', '.join(_KNOWN)}")]
    s = snapshot(ws)
    dev, test, sealed = s["roles"]["dev"], s["roles"]["test"], s["roles"]["sealed"]
    prereg_evals = {p["eval"] for p in s["preregs"] if p["eval"]}
    gates: list[Gate] = []

    if command == "run":
        gates.append(Gate("dev-fence", bool(dev),
                          f"dev set registered: {dev or 'NONE'}",
                          fix="split your corpus and register the dev file "
                              "with role=dev"))
        gates.append(Gate("leak-audit", True,
                          "every gold and synthetic lane in the config will "
                          "be audited (target-anchored) against "
                          f"{len(test) + len(sealed)} test/sealed set(s) — "
                          "fatal on answer leakage",
                          fix="pre-clean with: nmt-forge leak-audit <corpus> "
                              "--clean-to <out.jsonl>"))
        gates.append(Gate("schedule-sanity", True,
                          "regime + early-stop floor are derived from the "
                          "config's data mix — no flags needed"))
        gates.append(Gate("generation-headroom", True,
                          "decode cap is checked against dev reference "
                          "lengths BEFORE training compute is spent"))
    elif command == "score":
        target_sets = test + sealed
        gates.append(Gate("eval-registered", bool(target_sets),
                          f"test/sealed set(s): {target_sets or 'NONE'}",
                          fix="nmt-forge registry add <name> <file> --role test"))
        missing = [t for t in target_sets if t not in prereg_evals]
        gates.append(Gate("preregistration", not missing,
                          "prereg bound for: "
                          f"{sorted(prereg_evals) or 'NONE'}"
                          + (f"; MISSING for: {missing}" if missing else ""),
                          fix="nmt-forge prereg new --eval <name> "
                              "--predictions <file>"))
        spent = [name for name in sealed
                 if s["ledger_events"].get(f"sealed-spend:{name}", 0) >= 1]
        gates.append(Gate("sealed-unspent", not spent,
                          f"sealed sets already spent: {spent or 'none'}",
                          fix="a sealed set is one-shot; there is no fix — "
                              "that is the point"))
    elif command == "split":
        gates.append(Gate("group-disjoint", True,
                          "pairs sharing a canonical source OR target land "
                          "on ONE side; verified after the carve, crash on "
                          "any overlap"))
    elif command == "prereg":
        gates.append(Gate("eval-registered", bool(test or sealed),
                          f"needs a registered test/sealed set: "
                          f"{(test + sealed) or 'NONE'}",
                          fix="register the eval first"))
    elif command == "leak-audit":
        gates.append(Gate("evals-registered", bool(dev or test or sealed),
                          "audit screens against registered dev/test/sealed "
                          f"sets: {dev + test + sealed or 'NONE'}",
                          fix="register your eval sets first or pass "
                              "prebuilt key sets"))
    return gates


# -- rendering ----------------------------------------------------------------

def render_status(ws: Workspace) -> str:
    s = snapshot(ws)
    a = next_action(ws)
    lines = [f"workspace: {s['workspace']}", ""]
    for role in ("dev", "test", "sealed"):
        names = s["roles"][role]
        lines.append(f"  {role:<7} {', '.join(names) if names else '—'}")
    lines.append(f"  prereg  {', '.join(p['id'] for p in s['preregs']) or '—'}")
    lines.append(f"  runs    {', '.join(r['run'] for r in s['runs']) or '—'}")
    lines.append("")
    for r in a.ready:
        lines.append(f"  ✓ {r}")
    for b in a.blockers:
        lines.append(f"  ✗ {b}")
    lines.append("")
    lines.append(f"NEXT: {a.command}")
    lines.append(f"      ({a.why})")
    return "\n".join(lines)


def render_preflight(ws: Workspace, command: str) -> str:
    gates = preflight(ws, command)
    lines = [f"preflight: nmt-forge {command}", ""]
    for g in gates:
        mark = "✓" if g.ok else "✗"
        lines.append(f"  {mark} {g.name}: {g.detail}")
        if not g.ok and g.fix:
            lines.append(f"      fix: {g.fix}")
    return "\n".join(lines)
