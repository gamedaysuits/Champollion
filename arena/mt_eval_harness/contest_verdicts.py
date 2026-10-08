"""contest_verdicts — paired significance for a SEALED contest, computed on the node.

A sealed contest's per-segment outputs never leave the organizer's node (the
sealed references are there and nowhere else), so the online ranker can only
tie entries on CI overlap or point equality. The node, though, keeps every
scored entry's aligned ``{id, expected, predicted}`` in its TestReports
(``external_scoring.score_hypotheses``). This module runs the contest's own
paired test (approximate randomization by default) there, over ALL pairs of
the contest's entries, and exports only the verdicts:

    request pair · method · p-value · delta · CI on the delta · segment count

signed with the node's score-sign key. No text, no per-segment rows: the
guard below refuses anything else. The online side (``load_verified``) checks
the signature against the node's public key and binds the verdicts to the
contest, its metric, its frozen tie policy and — when promised — its harness
version, before ``contest_rank`` uses them as rung-1 evidence.

All pairs, not adjacent pairs, on purpose: which entries end up adjacent is
decided online (tracks, primary/contrastive, deferred results published at
close), and a node that had to know that ordering would couple the verdicts to
a ranking it cannot see. With the sufficient-statistics fast path
(``significance._paired_stats``) a pair on 1,000 segments costs under a second.
"""

from __future__ import annotations

import hashlib
import json
from itertools import combinations
from pathlib import Path
from typing import Optional

from mt_eval_harness import __version__ as HARNESS_VERSION
from mt_eval_harness.rankable_metrics import RANKABLE_METRICS, SEGMENT_FUNCTIONS
from mt_eval_harness.significance import (
    paired_approximate_randomization,
    paired_bootstrap,
)

VERDICTS_KIND = "champollion-node-verdicts"
VERDICTS_VERSION = 1

_MAX_ID_LEN = 200
_PAIR_KEYS = frozenset({
    "a", "b", "comparable", "reason", "method", "p_value", "delta",
    "ci_lower", "ci_upper", "n_segments", "significant",
})
_ENTRY_KEYS = frozenset({"request_id", "n_segments", "segment_ids_sha256"})
_TOP_KEYS = frozenset({
    "kind", "version", "contest_id", "sealed_set_id", "node_id",
    "harness_version", "metric", "tie_policy", "entries", "pairs",
})
_REASONS = frozenset({"segment ids differ"})


class VerdictsError(RuntimeError):
    """Verdicts that cannot be computed, signed or trusted — always with why."""


# ---------------------------------------------------------------------------
# Node side
# ---------------------------------------------------------------------------

def _report_submission(report_path: Path, report: dict) -> dict:
    """The run log's ``provenance.submission`` for a TestReport."""
    source_log = report.get("source_log")
    candidates = [Path(source_log)] if source_log else []
    candidates.append(report_path.with_name(
        report_path.name.removesuffix("_report.json") + ".json"))
    for log_path in candidates:
        if log_path.exists():
            run_log = json.loads(log_path.read_text(encoding="utf-8"))
            return (run_log.get("provenance") or {}).get("submission") or {}
    return {}


def find_entry_reports(run_roots: list[Path], *, contest_id: str,
                       sealed_set_id: str) -> dict[str, Path]:
    """The main-set TestReport of every request this node scored for a contest.

    Looks one level inside each request directory of each root — the
    connected node's ``output_dir/<request_id>/`` and the air-gapped node's
    ``state_dir/<request_id>/runs/`` — never in ``holdout``, ``test-suites``
    or ``qualifier``, which score other sets. A request with two main-set
    reports is ambiguous and refused, not guessed.
    """
    found: dict[str, Path] = {}
    for root in run_roots:
        root = Path(root).expanduser()
        if not root.is_dir():
            continue
        for request_dir in sorted(p for p in root.iterdir() if p.is_dir()):
            for d in (request_dir, request_dir / "runs"):
                for report_path in sorted(d.glob("*_report.json")):
                    report = json.loads(report_path.read_text(encoding="utf-8"))
                    if (report.get("config") or {}).get("dataset_id") != sealed_set_id:
                        continue
                    sub = _report_submission(report_path, report)
                    if sub.get("contest_id") != contest_id:
                        continue
                    request_id = sub.get("request_id") or request_dir.name
                    if request_id in found and found[request_id] != report_path:
                        raise VerdictsError(
                            f"request {request_id} has two main-set reports "
                            f"({found[request_id]} and {report_path}); remove the "
                            f"stale one — the node will not guess which was scored")
                    found[request_id] = report_path
    return found


def load_segments(report_path: Path) -> list[dict]:
    """``[{id, expected, predicted, error}]`` from a TestReport, in id order."""
    report = json.loads(Path(report_path).read_text(encoding="utf-8"))
    rows = [{
        "id": str(e.get("id")),
        "expected": e.get("expected") or "",
        "predicted": e.get("predicted") or "",
        "error": e.get("error"),
    } for e in report.get("entries") or []]
    rows.sort(key=lambda r: r["id"])
    return rows


def _ids_sha256(segments: list[dict]) -> str:
    return hashlib.sha256("\n".join(s["id"] for s in segments).encode()).hexdigest()


def compute_node_verdicts(
    reports: dict[str, Path],
    *,
    contest_id: str,
    sealed_set_id: str,
    node_id: str,
    metric_id: str,
    tie_test: str,
    alpha: float,
    n_resamples: int,
    seed: int,
) -> dict:
    """Paired verdicts for every pair of the contest's entries on this node."""
    if metric_id not in RANKABLE_METRICS:
        raise VerdictsError(f"{metric_id!r} is not a rankable metric")
    seg_fn = SEGMENT_FUNCTIONS.get(metric_id)
    if seg_fn is None:
        raise VerdictsError(
            f"{RANKABLE_METRICS[metric_id]['label']} has no per-segment "
            f"recomputation, so no paired test exists for it; the contest ranks "
            f"on CI overlap or point equality")
    if tie_test not in ("ar", "bootstrap"):
        raise VerdictsError(f"tie_test must be ar or bootstrap, got {tie_test!r}")
    if len(reports) < 2:
        raise VerdictsError(
            f"{len(reports)} scored entr{'y' if len(reports) == 1 else 'ies'} "
            f"for {contest_id} on this node — a paired test needs two")

    segments = {rid: load_segments(path) for rid, path in reports.items()}
    entries = [{"request_id": rid, "n_segments": len(segs),
                "segment_ids_sha256": _ids_sha256(segs)}
               for rid, segs in sorted(segments.items())]

    pairs = []
    for a, b in combinations(sorted(segments), 2):
        seg_a, seg_b = segments[a], segments[b]
        if [s["id"] for s in seg_a] != [s["id"] for s in seg_b]:
            pairs.append({"a": a, "b": b, "comparable": False,
                          "reason": "segment ids differ"})
            continue
        if tie_test == "ar":
            res = paired_approximate_randomization(
                seg_a, seg_b, seg_fn, n_trials=n_resamples, alpha=alpha,
                seed=seed, metric_name=metric_id)
            method = "approximate_randomization"
        else:
            res = paired_bootstrap(
                seg_a, seg_b, seg_fn, n_bootstrap=n_resamples, alpha=alpha,
                seed=seed, metric_name=metric_id)
            method = "paired_bootstrap"
        pairs.append({
            "a": a, "b": b, "comparable": True, "method": method,
            "p_value": res.p_value, "delta": res.delta,
            "ci_lower": res.ci_lower, "ci_upper": res.ci_upper,
            "n_segments": len(seg_a), "significant": bool(res.significant),
        })

    doc = {
        "kind": VERDICTS_KIND,
        "version": VERDICTS_VERSION,
        "contest_id": contest_id,
        "sealed_set_id": sealed_set_id,
        "node_id": node_id,
        "harness_version": HARNESS_VERSION,
        "metric": metric_id,
        "tie_policy": {"tie_test": tie_test, "alpha": alpha,
                       "n_resamples": n_resamples, "seed": seed},
        "entries": entries,
        "pairs": pairs,
    }
    assert_verdicts_only(doc)
    return doc


def assert_verdicts_only(doc: dict) -> None:
    """Refuse anything but ids, counts and statistics — no text leaves the node."""
    def short(v) -> bool:
        return isinstance(v, str) and 0 < len(v) <= _MAX_ID_LEN and "\n" not in v

    if set(doc) != _TOP_KEYS:
        raise VerdictsError(f"verdicts keys must be exactly {sorted(_TOP_KEYS)}, "
                            f"got {sorted(doc)}")
    for key in ("kind", "contest_id", "sealed_set_id", "node_id",
                "harness_version", "metric"):
        if not short(doc[key]):
            raise VerdictsError(f"verdicts.{key} must be a short id string")
    policy = doc["tie_policy"]
    if set(policy) != {"tie_test", "alpha", "n_resamples", "seed"} or \
            not all(isinstance(policy[k], (int, float)) and not isinstance(policy[k], bool)
                    for k in ("alpha", "n_resamples", "seed")):
        raise VerdictsError("verdicts.tie_policy is malformed")
    for e in doc["entries"]:
        if set(e) != _ENTRY_KEYS or not short(e["request_id"]) or \
                not isinstance(e["n_segments"], int) or len(e["segment_ids_sha256"]) != 64:
            raise VerdictsError(f"verdicts entry is malformed: {sorted(e)}")
    for p in doc["pairs"]:
        if not set(p) <= _PAIR_KEYS or not short(p["a"]) or not short(p["b"]):
            raise VerdictsError(f"verdicts pair is malformed: {sorted(p)}")
        for k, v in p.items():
            if k in ("a", "b", "method"):
                continue
            if k == "reason":
                if v not in _REASONS:
                    raise VerdictsError(f"verdicts pair reason {v!r} is not a known reason")
            elif not isinstance(v, (int, float, bool)):
                raise VerdictsError(f"verdicts pair.{k} must be a number or boolean")


def write_signed_verdicts(doc: dict, out_path: Path, signing_key: Path) -> Path:
    """Write the verdicts (sorted keys, the exact bytes signed) and sign them."""
    from mt_eval_harness.airgap_transport import sign_file
    assert_verdicts_only(doc)
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, sort_keys=True, indent=2) + "\n",
                        encoding="utf-8")
    return sign_file(out_path, Path(signing_key))


# ---------------------------------------------------------------------------
# Online side
# ---------------------------------------------------------------------------

def load_verified(path: Path, verify_key: Path, *, contest: dict, metric_id: str,
                  tie_policy: dict, promised_harness: Optional[str]) -> dict:
    """Verify, bind and index node verdicts. Returns
    ``{"node_id", "path", "pairs": {frozenset({a, b}): pair}}``.

    Every check refuses rather than repairs: an unsigned, mis-signed, or
    differently-configured verdicts file is not evidence for THIS ranking.
    """
    from mt_eval_harness.airgap_transport import verify_file
    path = Path(path)
    sig_path = path.with_name(path.name + ".sig.json")
    if not sig_path.exists():
        raise VerdictsError(f"{path} has no signature ({sig_path.name}); unsigned "
                            f"verdicts are not evidence")
    if not verify_file(path, sig_path, Path(verify_key)):
        raise VerdictsError(f"{path}: signature does not verify against {verify_key}")
    doc = json.loads(path.read_text(encoding="utf-8"))
    assert_verdicts_only(doc)
    if doc["kind"] != VERDICTS_KIND or doc["version"] != VERDICTS_VERSION:
        raise VerdictsError(f"{path} is not {VERDICTS_KIND} v{VERDICTS_VERSION}")

    def mismatch(what, theirs, ours):
        return VerdictsError(f"node verdicts were computed for {what} {theirs!r}; "
                             f"this ranking uses {ours!r}")

    if doc["contest_id"] != contest.get("id"):
        raise mismatch("contest", doc["contest_id"], contest.get("id"))
    if doc["sealed_set_id"] != contest.get("corpus_id"):
        raise mismatch("sealed set", doc["sealed_set_id"], contest.get("corpus_id"))
    if doc["metric"] != metric_id:
        raise mismatch("metric", doc["metric"], metric_id)
    for key in ("tie_test", "alpha", "n_resamples", "seed"):
        if doc["tie_policy"][key] != tie_policy[key]:
            raise mismatch(f"tie policy {key}", doc["tie_policy"][key], tie_policy[key])
    if promised_harness and doc["harness_version"] != promised_harness:
        raise mismatch("harness", doc["harness_version"], promised_harness)
    return {
        "node_id": doc["node_id"],
        "path": str(path),
        "pairs": {frozenset((p["a"], p["b"])): p for p in doc["pairs"]},
    }


def evidence_for(verdicts: dict, upper: dict, lower: dict, label: str) -> Optional[dict]:
    """Rung-1 evidence for an adjacent pair from node verdicts, or None."""
    ra = upper.get("authorization_request_id")
    rb = lower.get("authorization_request_id")
    if not ra or not rb:
        return None
    pair = verdicts["pairs"].get(frozenset((ra, rb)))
    if pair is None or not pair.get("comparable"):
        return None
    sign = 1.0 if pair["a"] == ra else -1.0
    delta = sign * pair["delta"]
    lo, hi = sorted((sign * pair["ci_lower"], sign * pair["ci_upper"]))
    tied = not pair["significant"]
    return {
        "method": pair["method"],
        "source": "node-verdicts",
        "node_id": verdicts["node_id"],
        "tied": tied,
        "reason": (f"{label}: p={pair['p_value']:.4f} on {pair['n_segments']} "
                   f"paired segments, computed on the organizer node "
                   f"{verdicts['node_id']} over the sealed set (signed verdicts; "
                   f"no segment left the node) — "
                   f"{'not ' if tied else ''}significant; delta={delta:+.4f}"),
        "p_value": pair["p_value"],
        "delta": round(delta, 6),
        "ci_lower": round(lo, 6),
        "ci_upper": round(hi, 6),
        "n_segments": pair["n_segments"],
    }


# ---------------------------------------------------------------------------
# `mt-eval node verdicts` — the node-side command
# ---------------------------------------------------------------------------

def run_node_verdicts(contest_id: str, *, config_path: Optional[str], out: str,
                      signing_key: Optional[str] = None,
                      metric: Optional[str] = None, tie_test: Optional[str] = None,
                      alpha: Optional[float] = None, n_resamples: Optional[int] = None,
                      seed: Optional[int] = None) -> Path:
    """Compute, guard, write and sign the contest's verdicts on this node.

    The metric and tie policy default to the contest's own recorded values
    (fetched read-only when this node is connected). An air-gapped node cannot
    fetch them and must be told — and the online side refuses verdicts whose
    metric or policy differ from the contest's, so a wrong flag fails closed.
    """
    from mt_eval_harness.contest_node import load_node_config
    cfg = load_node_config(config_path)
    contest_cfg = (cfg.get("contests") or {}).get(contest_id)
    if not contest_cfg or not contest_cfg.get("secret_set_id"):
        raise VerdictsError(
            f"node config has no method-lane entry for {contest_id} "
            f"(contests.{contest_id}.secret_set_id)")
    key = signing_key or cfg.get("signing_key")
    if not key:
        raise VerdictsError(
            "no signing key: pass --signing-key or set node.json signing_key "
            "(the node's score-sign .key.json)")

    if None in (metric, tie_test, alpha, n_resamples, seed):
        from mt_eval_harness import contest_rank
        try:
            contest = contest_rank.fetch_contest(contest_id)
        except Exception as exc:  # an air-gapped node has no network at all
            raise VerdictsError(
                f"could not read {contest_id}'s recorded metric and tie policy "
                f"({exc}); on an air-gapped node pass --metric, --tie-test, "
                f"--alpha, --n-resamples and --seed explicitly") from exc
        recorded_metric, _ = contest_rank.resolve_metric(None, contest)
        policy = contest_rank.resolve_tie_policy(contest)
        metric = metric or recorded_metric
        tie_test = tie_test or policy["tie_test"]
        alpha = policy["alpha"] if alpha is None else alpha
        n_resamples = policy["n_resamples"] if n_resamples is None else n_resamples
        seed = policy["seed"] if seed is None else seed

    roots = [Path(cfg.get("output_dir", "~/.mt-eval/node-runs")).expanduser()]
    airgap_state = (cfg.get("airgap") or {}).get("state_dir")
    if airgap_state:
        roots.append(Path(airgap_state).expanduser())
    reports = find_entry_reports(roots, contest_id=contest_id,
                                 sealed_set_id=contest_cfg["secret_set_id"])
    doc = compute_node_verdicts(
        reports, contest_id=contest_id, sealed_set_id=contest_cfg["secret_set_id"],
        node_id=cfg["node_id"], metric_id=metric, tie_test=tie_test,
        alpha=float(alpha), n_resamples=int(n_resamples), seed=int(seed))
    sig = write_signed_verdicts(doc, Path(out), Path(key).expanduser())
    comparable = sum(1 for p in doc["pairs"] if p.get("comparable"))
    print(f"  ✓ {len(doc['pairs'])} pair(s) over {len(reports)} entr"
          f"{'y' if len(reports) == 1 else 'ies'} ({comparable} comparable), "
          f"metric {metric}, {tie_test} α={alpha} n={n_resamples} seed={seed}")
    print(f"    {out}\n    {sig}")
    print("    Verdicts only — no segment, reference or hypothesis is in the "
          "file. Carry it out and pass it to `mt-eval contest close "
          "--node-verdicts … --verify-key <node .pub.json>`.")
    return Path(out)
