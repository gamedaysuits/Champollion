"""``nmt-forge floor <dictionary>…`` — what a dictionary alone gets on dev.

The floor a trained model has to beat. Every sentence of the registered dev
set is translated word for word by the eval harness's ``lexicon`` engine
(``mt_eval_harness.methods.lexicon``: the longest listed phrase first, its
first listed translation, every other word kept) and scored by the SAME code
as a run's dev report (``ci_scoring.score``: chrF++ with its 95% bootstrap
CI), so the two numbers are comparable. The dev set is read through the
dev-fence, like training reads it; the test set is never touched.

Nothing leaves the machine, and nothing written holds a word: the ledger
event (``floor``) and ``<workspace>/floors/<dev>.json`` carry each
dictionary's file name, sha256 and entry count, the dev set, how many source
words the dictionaries reached, and the scores. ``status`` shows the floor
beside every run's dev score and warns when a run does not beat it.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from . import _harness
from .errors import ForgeError

FLOOR_EVENT = "floor"
FLOORS_DIR = "floors"
#: the metric the floor is compared on (the dev report's headline)
FLOOR_METRIC = "chrf++"


def _project_pair(ws) -> tuple[str, str]:
    """(source, target) from the config.json beside the workspace, or ("", "")."""
    cfg = Path(ws.root).parent / "config.json"
    try:
        lang = (json.loads(cfg.read_text(encoding="utf-8")) or {}).get("language") or {}
    except (OSError, ValueError):
        return "", ""
    return str(lang.get("source") or ""), str(lang.get("target") or "")


def _dev_name(ws, dev: str | None) -> str:
    devs = ws.registry.names(roles=("dev",))
    if dev:
        return dev
    if len(devs) == 1:
        return devs[0]
    if not devs:
        raise ForgeError(
            "no dev set is registered, so there is nothing to measure the "
            "floor on\n"
            "  why: the floor is read on the dev set (never the test set), "
            "the same sentences a run's dev score is read on\n"
            "  fix: carve one first — `nmt-forge split <corpus> --test 0 "
            "--dev <N> --seed 42 --out data/split --register project`")
    raise ForgeError(f"several dev sets are registered ({', '.join(devs)}) — "
                     "say which: --dev <name>")


def measure_floor(ws, dictionaries: list[str], *, dev: str | None = None) -> dict:
    """Translate the dev set by dictionary lookup and score it; ledger and
    write the content-free record. Returns that record."""
    from .guards import ci_scoring
    from .guards.dev_fence import DevFence

    if not dictionaries:
        raise ForgeError("which dictionary? `nmt-forge floor data/lexicon/<file>.tsv`")
    _harness.load_harness()
    from mt_eval_harness.methods.base_http_mt import MTConfigError
    from mt_eval_harness.methods.lexicon import LexiconMethod, load_lexicon, lookup

    source, target = _project_pair(ws)
    table: dict = {}
    used = []
    for d in dictionaries:
        try:
            ident = LexiconMethod.resolve_identity(
                {"model": d}, source_code=source, target_code=target)
            entries = load_lexicon(d)
        except MTConfigError as exc:
            raise ForgeError(str(exc)) from exc
        # several lists: the first one named wins where they disagree
        for key, targets in entries.items():
            have = table.setdefault(key, [])
            have.extend(t for t in targets if t not in have)
        used.append({"name": ident["id"], "sha256": ident["sha256"],
                     "entries": ident["entries"]})

    name = _dev_name(ws, dev)
    raw = DevFence(ws).require_dev(name)
    entry = ws.registry.get(name)
    sources = [str(r.get(entry["source_field"], "")) for r in raw]
    refs = [str(r.get(entry["target_field"], "")) for r in raw]
    longest = max(len(k) for k in table)
    hyps, words, found = [], 0, 0
    for s in sources:
        out, w, f = lookup(s, table, longest)
        hyps.append(out)
        words += w
        found += f
    report = ci_scoring.score(hyps, refs, sources, target_lang=target)
    record = {
        "dev_set": name,
        "n": report.n,
        "dictionaries": used,
        "coverage": {"source_words": words, "found": found,
                     "share": round(found / words, 4) if words else 0.0},
        "metric": FLOOR_METRIC,
        "scores": report.scores,
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    ws.ledger.append(FLOOR_EVENT, **{k: v for k, v in record.items() if k != "ts"})
    out_dir = Path(ws.root) / FLOORS_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"{name}.json").write_text(
        json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return record


def floor_score(record: dict | None) -> dict | None:
    """``{score, ci}`` of a floor record's headline metric, or None."""
    s = ((record or {}).get("scores") or {}).get(FLOOR_METRIC)
    if not isinstance(s, dict) or not isinstance(s.get("score"), (int, float)):
        return None
    ci = [s["ci_lower"], s["ci_upper"]] if "ci_lower" in s else None
    return {"score": s["score"], "ci": ci}


def floor_text(record: dict) -> str:
    """One line: the floor, its CI, and how much of dev the dictionary reached."""
    from .scoring_standard import label

    s = floor_score(record)
    cov = record.get("coverage") or {}
    names = ", ".join(d.get("name", "?") for d in record.get("dictionaries") or [])
    score = (f"{label(FLOOR_METRIC)} {s['score']:.2f}"
             + (f" [{s['ci'][0]:.2f}, {s['ci'][1]:.2f}]" if s and s["ci"] else "")
             if s else "no score")
    return (f"dictionary floor on dev set {record.get('dev_set')} "
            f"({record.get('n')} sentences, {names}): {score} — the "
            f"dictionary reached {cov.get('found', 0)} of "
            f"{cov.get('source_words', 0)} source words "
            f"({100 * float(cov.get('share') or 0):.0f}%)")


def beats_floor(dev_score: dict | None, floor: dict | None) -> bool | None:
    """True when a run's dev score is above the floor with the two 95%
    intervals apart; False when not; None when either is missing."""
    if not dev_score or not floor or not isinstance(dev_score.get("score"), (int, float)):
        return None
    dci, fci = dev_score.get("ci"), floor.get("ci")
    if dci and fci:
        return dci[0] > fci[1]
    return dev_score["score"] > floor["score"]
