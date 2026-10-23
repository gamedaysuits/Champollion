"""A round's verdict: is the new model measurably better than the one in use?

Paired on the dev set — the same sentences, row by row, each run's saved
translations (``dev-outputs.jsonl``, written by every run) — with the
harness's paired approximate-randomization test and a bootstrap interval on
the difference. The test set is not read here: rounds are judged on dev, and
the test set is kept for milestones.

Verdicts (the interval AND the paired test must agree — on a small dev set a
percentile interval alone calls equal models different too often: 11 of 60
draws at 23 sentences, docs/FORGE_MACHINE_CRITIQUE_2026-10-12.md):
  too-few      fewer than MIN_DECIDING (50) dev sentences: no rule decides there
               (stress test 6, on G1's outputs: at 23 sentences even the
               interval-and-p rule called near-equal models different 9 times in
               100, and saw a real +5.9 gain only 21 times in 100; at 50, 4 and
               96). The model in use stays; the next review sheet mixes both
               models' drafts blind, and the speaker's marks decide
               (improve.speaker)
  better       the interval's lower bound is above zero and p < 0.05 — put it to use
  worse        the upper bound is below zero and p < 0.05 — keep the model in use
  no-change    otherwise — no measurable change; keep the model in use, and say
               so (more data, or a different model, may be the next step —
               never "it got a bit better")

Every verdict also says the smallest difference its dev set can show reliably
(80% of the time, two-sided 5%), from the comparison's own interval: a round
that adds a little to a model judged on 23 sentences reads "no measurable
change" whatever it did, and the people should know that is the dev set's
limit, not the round's.

The dev set may GROW between rounds (practice sentences the speaker writes,
`nmt-forge grow-dev`): the new run was tuned on it as it is now; the model in
use translates the grown set again here, so the pair is still the same
sentences, row by row.
"""

from __future__ import annotations

import json
from pathlib import Path

from ..errors import GuardrailViolation
from ..guards import ci_scoring
from ..guards.dev_fence import DevFence
from ..errors import ForgeError
from ..training.run import decode_with_run, read_dev_outputs
from ..workspace import Workspace

IMPROVE_COMPARE = "improve-compare"
ALPHA = 0.05
# a dev set that cannot see a 3-point gain is too small to steer rounds by:
# G1 (docs/RAILS_G1_RESULT_2026-10-12.md) rose ~14 chrF++ per doubling of
# data at 1.6k–6.4k pairs, so a round of 50 sentences on 1,600 is worth ~+0.6
SMALL_ENOUGH = 3.0
# below this many dev sentences no verdict rule decides reliably (stress test
# 6: 4 wrong calls in 100 and 96% of a real +5.9 gain seen at 50; 9 and 21% at 23)
MIN_DECIDING = 50
# z for a two-sided 5% test and for 80% power: the smallest true difference
# detected 8 times in 10 is (z_alpha + z_power) standard errors, and the
# interval is 2 * z_alpha standard errors wide
_Z_ALPHA, _Z_POWER = 1.959964, 0.841621


def detectable_difference(ci: list | tuple | None) -> float | None:
    """The smallest chrF++ difference this comparison's dev set shows 80% of
    the time, from its 95% interval (normal approximation)."""
    if not ci or ci[0] is None or ci[1] is None:
        return None
    return round((ci[1] - ci[0]) * (_Z_ALPHA + _Z_POWER) / (2 * _Z_ALPHA), 1)


class RoundError(GuardrailViolation):
    """A round cannot be judged as asked (why and fix say what to do)."""

    guard = "improve-loop"


def _manifest(path: str | Path) -> dict:
    p = Path(path)
    if p.is_dir():
        p = p / "run-manifest.json"
    if not p.is_file():
        raise RoundError(f"no run manifest at {path}",
                         why="a round is judged between two trained runs",
                         fix="pass the run-manifest.json of each run (`nmt-forge status` lists them)")
    m = json.loads(p.read_text())
    m.setdefault("manifest_path", str(p))
    return m


def compare_runs(ws: Workspace, in_use: str | Path, new: str | Path, *,
                 n_trials: int = 1000, n_bootstrap: int = 1000, seed: int = 12345) -> dict:
    """The new run against the run in use, on their shared dev set. Writes an
    ``improve-compare`` ledger event (counts and scores only) and returns it."""
    a, b = _manifest(in_use), _manifest(new)
    dev_a, dev_b = (a.get("dev_set") or {}), (b.get("dev_set") or {})
    if dev_a.get("name") != dev_b.get("name"):
        raise RoundError(
            "these runs were tuned on different dev sets — a round can only be judged on the same sentences",
            why="a paired comparison reads both models' translations of the SAME dev rows; a different dev "
                "set makes every difference meaningless (the dev set is kept across rounds, and only grows)",
            fix="train the new round with the dev set the model in use was tuned on (config.json data.dev)")
    rows = DevFence(ws).require_dev(dev_b["name"])
    entry = ws.registry.get(dev_b["name"])
    refs = [str(r.get(entry["target_field"], "")) for r in rows]
    sources = [str(r.get(entry["source_field"], "")) for r in rows]
    head_b, hyps_b = read_dev_outputs(Path(b["manifest_path"]).parent)
    if not hyps_b:
        raise RoundError(
            f"no saved dev translations for {b['run_name']}",
            why="runs trained before 2026-10 did not keep their dev translations",
            fix="train that round again with this forge (the same config on grown data is a new run)")
    if (dev_b.get("sha256") != entry["sha256"] or head_b.get("dev_sha256") != entry["sha256"]
            or len(hyps_b) != len(refs)):
        raise RoundError("the dev set changed after the new run was trained",
                         why="the new model is judged on the dev set it was tuned on, as it is now",
                         fix="train the round again (nmt-forge run config.json), then compare")
    head_a, hyps_a = read_dev_outputs(Path(a["manifest_path"]).parent)
    redecoded = False
    if not hyps_a or head_a.get("dev_sha256") != entry["sha256"] or len(hyps_a) != len(refs):
        # the dev set grew since the model in use was trained (or that run kept
        # no translations): it translates the dev set as it is now
        try:
            hyps_a = decode_with_run(a, sources)
        except ForgeError as e:
            raise RoundError(
                f"the model in use ({a['run_name']}) cannot translate the dev set as it is now",
                why=str(e).split("\n")[0],
                fix="train that round again with this forge, or compare against a newer run") from e
        redecoded = True
    report = ci_scoring.compare(hyps_b, hyps_a, refs, sources, labels=("new", "in use"),
                                metrics=("chrf++",), n_trials=n_trials, n_bootstrap_ci=n_bootstrap, seed=seed)
    r = report.results["chrf++"]
    lo, hi, p = r["ci_lower"], r["ci_upper"], r["p_value"]
    significant = p is not None and p < ALPHA
    verdict = ("too-few" if len(refs) < MIN_DECIDING
               else "better" if significant and lo is not None and lo > 0
               else "worse" if significant and hi is not None and hi < 0 else "no-change")
    rounds = [e for e in ws.ledger.find(IMPROVE_COMPARE)]
    event = {
        "round": len(rounds) + 1,
        "in_use": a["run_name"], "in_use_manifest": a["manifest_path"],
        "new": b["run_name"], "new_manifest": b["manifest_path"],
        "dev_set": dev_b["name"], "n": len(refs),
        "score_in_use": round(r["score_b"], 2), "score_new": round(r["score_a"], 2),
        "delta": round(r["delta"], 2), "ci": [round(lo, 2), round(hi, 2)] if lo is not None else None,
        "p_value": p, "verdict": verdict,
        "detectable": detectable_difference([lo, hi]),
        "in_use_redecoded": redecoded,
    }
    event["text"] = verdict_text(event)      # the rails relay it as written
    ws.ledger.append(IMPROVE_COMPARE, **event)
    return event


def verdict_text(e: dict) -> str:
    """The round's verdict in plain words, with what its dev set can see."""
    ci = e.get("ci")
    span = f" (difference {e['delta']:+.1f}, 95% interval {ci[0]:+.1f} to {ci[1]:+.1f})" if ci else ""
    head = (f"round {e['round']}: on the same {e['n']} dev sentences the new model scores "
            f"chrF++ {e['score_new']:.1f} against {e['score_in_use']:.1f} for the model in use (0–100){span}")
    d = e.get("detectable")
    limit = (f" With {e['n']} dev sentences, only a difference of about {d:.1f} chrF++ points or more "
             "shows up reliably (8 times in 10)." if d is not None else "")
    if e["verdict"] == "too-few":
        return (head + f" — too few dev sentences to tell: below {MIN_DECIDING}, a difference is not told "
                "from chance reliably, whatever its size." + limit + " The model in use stays for now. The next "
                "review sheet mixes both models' drafts, unmarked, and the speaker's marks decide; the practice "
                "sentences on every sheet grow the dev set until it can.")
    if e["verdict"] == "better":
        return head + " — measurably better: put it to use." + limit
    if e["verdict"] == "worse":
        return head + " — measurably worse: keep the model in use." + limit
    small = (" A smaller real gain reads as no change here: a bigger dev set (the speaker's practice "
             "sentences) lets it show." if d is not None and d > SMALL_ENOUGH else "")
    return (head + " — no measurable change: keep the model in use." + limit + small
            + " More sentences of the kinds it gets wrong, or a different model, may be what it needs.")


def latest_verdict(ws: Workspace, new_manifest: str | Path) -> dict | None:
    """The newest improve-compare event for this new run, if any."""
    want = str(Path(new_manifest))
    hits = [e for e in ws.ledger.find(IMPROVE_COMPARE)
            if str(Path(e.get("new_manifest", ""))) == want]
    return hits[-1] if hits else None
