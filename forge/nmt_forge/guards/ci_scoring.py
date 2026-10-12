"""ci-scoring — bootstrap CIs by default, via the harness (guards #8, #10).

Two catalogued failures live here:

#8  "Oral-story improved 16.7 → 18.1" on 37 sentences — noise dressed as
    signal. Every score forge renders carries its 95% bootstrap CI; the
    report type has no CI-less rendering path.

#10 battery.py partially re-implemented scoring and drifted. forge implements
    ZERO metric math. Point scores, bootstrap CIs (Efron 1979 / Koehn 2004,
    sacrebleu-matched defaults n=1000 seed=12345), and paired approximate
    randomization (Riezler & Maxwell 2005) all come from ``mt_eval_harness``
    (``confidence`` and ``significance`` modules) — the maintained referee.

Two access levels:

- :func:`score` / :func:`compare` — plain hyps/refs, no workspace: for
  ad-hoc/dev iteration. CIs still mandatory.
- :func:`score_eval_set` / :func:`compare_on_eval_set` — the audited path for
  REGISTERED sets: sha verified, read ledgered, sealed spend gated, and for
  ``test``/``sealed`` roles the PREREGISTRATION GATE applies — no prereg, no
  table (guard #3/#9).

LYSS lanes: every function takes ``plugins=`` — harness-protocol metric
plugins (e.g. ``champollion_lyss.crk.metrics:CrkLinterMetric``). Each numeric
aggregate a plugin reports becomes a scored lane named
``<plugin>:<key>`` with its own bootstrap CI; per-entry computation runs once
(see :class:`nmt_forge.plugins.PluginLane`), and a plugin that reports
``available: False`` is shown unavailable — never fabricated.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from .. import _harness
from ..errors import ScoringError
from ..plugins import PluginLane
from ..registry import load_rows
from ..workspace import Workspace
from . import preregister
from .leak_audit import NEAR_TWIN_JACCARD

DEFAULT_METRICS = ("chrf++", "bleu", "exact_match")


def _metric_fns() -> dict:
    sig = _harness.significance()
    return {
        "chrf++": sig.corpus_chrf,
        "bleu": sig.corpus_bleu,
        "exact_match": sig.exact_match_rate,
    }


# -- neural lanes: the harness's COMET / COMET-QE / MetricX, delegated --------
#
# Inference runs ONCE per entry set; per-entry scores are cached ON the entry
# dicts (the harness's own keys — comet_score/qe_score/metricx_score), and the
# bootstrap/AR machinery re-averages cached scores (the harness confidence.py
# pattern) — resampling never re-runs a model. Unavailable extras report an
# install fix, never a fabricated number. MetricX is LOWER-IS-BETTER; the
# direction rides with the score everywhere (rendering, selection, winners).

def _comet_loader():
    _harness.load_harness()
    from mt_eval_harness import metrics_comet as mc

    if not mc.HAS_COMET:
        return None
    return lambda entries, target_lang: mc.compute_comet(
        entries, target_lang=target_lang)


def _qe_loader():
    _harness.load_harness()
    from mt_eval_harness import metrics_comet as mc

    if not mc.HAS_COMET:
        return None
    return lambda entries, target_lang: mc.compute_qe(
        entries, target_lang=target_lang)


def _metricx_loader():
    _harness.load_harness()
    from mt_eval_harness import metrics_metricx as mx

    if not mx.HAS_METRICX:
        return None
    return lambda entries, target_lang: mx.compute_metricx(
        entries, target_lang=target_lang)


NEURAL_LANES: dict[str, dict] = {
    "comet": {"cache_key": "comet_score", "direction": "higher",
              "loader": _comet_loader,
              "fix": "python3 -m pip install 'mt-eval-harness[comet]' (unbabel-comet + torch)"},
    "comet-qe": {"cache_key": "qe_score", "direction": "higher",
                 "loader": _qe_loader,
                 "fix": "python3 -m pip install 'mt-eval-harness[comet]' (unbabel-comet + torch)"},
    "metricx": {"cache_key": "metricx_score", "direction": "lower",
                "loader": _metricx_loader,
                "fix": "python3 -m pip install 'mt-eval-harness[metricx]' + the google-research/"
                       "metricx package (see the harness docs)"},
}


def _cached_mean_fn(cache_key: str):
    def fn(sub_entries: list[dict]) -> float:
        vals = [e[cache_key] for e in sub_entries
                if not e.get("error")
                and isinstance(e.get(cache_key), (int, float))]
        return sum(vals) / len(vals) if vals else 0.0

    fn.__name__ = f"cached:{cache_key}"
    return fn


def _attach_neural(name: str, entries: list[dict], target_lang: str):
    """Run one neural lane once; cache per-entry scores on the entries.

    Returns ``(metric_fn, meta)`` or ``(None, reason)`` — honest
    unavailability, mirroring the harness's None-not-zero contract.
    """
    spec = NEURAL_LANES[name]
    compute = spec["loader"]()
    if compute is None:
        return None, f"unavailable — {spec['fix']}"
    result = compute(entries, target_lang)
    if result is None or not getattr(result, "per_entry_scores", None):
        return None, ("model produced no scores (see harness output); "
                      f"if uninstalled: {spec['fix']}")
    idx = 0
    for e in entries:  # scores align to non-errored entries, in order
        if not e.get("error") and idx < len(result.per_entry_scores):
            e[spec["cache_key"]] = result.per_entry_scores[idx]
            idx += 1
    meta = {
        "direction": spec["direction"],
        "model": getattr(result, "model_name", None),
    }
    if getattr(result, "low_resource_warning", False):
        meta["low_resource_warning"] = (
            "target language is outside the metric model's well-covered "
            "tier — check metric reliability before trusting this lane")
    return _cached_mean_fn(spec["cache_key"]), meta


def build_entries(
    hyps: list[str], refs: list[str], sources: list[str] | None = None
) -> list[dict]:
    """Harness entry dicts from parallel lists (the harness's universal currency)."""
    if len(hyps) != len(refs):
        raise ScoringError(
            f"{len(hyps)} hypotheses vs {len(refs)} references",
            why="misaligned lists score the wrong rows against each other",
            fix="decode exactly the eval set you score, in its row order",
        )
    if sources is not None and len(sources) != len(refs):
        raise ScoringError(f"{len(sources)} sources vs {len(refs)} references")
    entries = []
    for i, (h, r) in enumerate(zip(hyps, refs)):
        entries.append({
            "id": i,
            "source": sources[i] if sources else "",
            "expected": r,
            "predicted": h,
            "error": None,
            "exact_match": h.strip() == r.strip(),
        })
    return entries


@dataclass
class ScoreReport:
    n: int
    scores: dict[str, dict]  # metric → {score, ci_lower, ci_upper, n_bootstrap, seed}
    eval_set: str | None = None
    config_hash: str | None = None
    plugin_aggregates: dict[str, dict] = field(default_factory=dict)
    notes: dict[str, str] = field(default_factory=dict)  # lane → why unavailable
    # the id mt-eval knows the set by (registry.dataset_identity) — set on
    # the report of a registered set; eval_set stays forge's name
    dataset_id: str | None = None
    dataset_id_source: str | None = None

    def format(self) -> str:
        """Render scores — ALWAYS with their CIs. There is no bare-score path."""
        lines = [f"n={self.n}" + (f" · set={self.eval_set}" if self.eval_set else "")
                 + _dataset_suffix(self.eval_set, self.dataset_id)]
        width = max((len(m) for m in self.scores), default=12)
        for m, s in self.scores.items():
            suffix = ""
            if s.get("direction") == "lower":
                suffix += "  (lower = better)"
            if s.get("low_resource_warning"):
                suffix += "  ⚠ low-resource: check metric reliability"
            lines.append(
                f"  {m:<{width}} {s['score']:.2f}  "
                f"[{s['ci_lower']:.2f}, {s['ci_upper']:.2f}] 95% CI" + suffix
            )
        for lane, reason in self.notes.items():
            lines.append(f"  {lane}: UNAVAILABLE — {reason}")
        for name, agg in self.plugin_aggregates.items():
            if agg.get("available") is False:
                lines.append(
                    f"  {name}: UNAVAILABLE — {agg.get('reason', 'no reason given')}"
                )
                continue
            details = []
            for k, v in agg.items():
                if isinstance(v, dict) and v and all(
                        isinstance(c, int) for c in v.values()):
                    inner = ", ".join(f"{ck}={cv}" for ck, cv in
                                      sorted(v.items(), key=lambda kv: -kv[1]))
                    details.append(f"{k}: {inner}")
            if details:
                lines.append(f"  {name} · " + " · ".join(details))
        return "\n".join(lines)

    def to_manifest(self) -> dict:
        return {
            "guard": "ci-scoring",
            "n": self.n,
            "eval_set": self.eval_set,
            "config_hash": self.config_hash,
            "scores": self.scores,
            "plugin_aggregates": self.plugin_aggregates,
            "notes": self.notes,
            **({"dataset_id": self.dataset_id,
                "dataset_id_source": self.dataset_id_source}
               if self.dataset_id else {}),
        }


def _dataset_suffix(eval_set: str | None, dataset_id: str | None) -> str:
    """' · dataset <id>' when mt-eval knows the set by another name."""
    if not dataset_id or dataset_id == eval_set:
        return ""
    return f" · dataset {dataset_id}"


def _identity(workspace: Workspace, eval_set: str) -> dict:
    """The registered set's dataset identity (registry.dataset_identity)."""
    return workspace.registry.identity(eval_set)


def score(
    hyps: list[str],
    refs: list[str],
    sources: list[str] | None = None,
    *,
    metrics: tuple[str, ...] = DEFAULT_METRICS,
    plugins: tuple = (),
    target_lang: str = "",
    n_bootstrap: int = 1000,
    seed: int = 12345,
    alpha: float = 0.05,
) -> ScoreReport:
    """Score with bootstrap CIs. All metric math is the harness's:
    deterministic lanes (chrf++/bleu/exact_match), neural lanes
    (comet/comet-qe/metricx — pass ``target_lang`` so the right model
    resolves), and ``plugins`` for LYSS-protocol referee lanes."""
    conf = _harness.confidence()
    entries = build_entries(hyps, refs, sources)
    fns = _metric_fns()
    notes: dict[str, str] = {}
    lane_meta: dict[str, dict] = {}
    scored_metrics: list[str] = []
    for m in metrics:
        if m in NEURAL_LANES:
            fn, meta = _attach_neural(m, entries, target_lang)
            if fn is None:
                notes[m] = meta  # honest unavailability, never a number
                continue
            fns[m] = fn
            lane_meta[m] = meta
        scored_metrics.append(m)
    plugin_aggregates: dict[str, dict] = {}
    for plugin in plugins:
        lane = PluginLane(plugin, entries)
        plugin_aggregates[lane.name] = lane.aggregate
        lane_fns = lane.metric_fns()
        fns.update(lane_fns)
        scored_metrics.extend(lane_fns)
    unknown = [m for m in scored_metrics if m not in fns]
    if unknown:
        raise ScoringError(
            f"unknown metric(s) {unknown}; forge speaks {sorted(fns)} plus "
            f"neural lanes {sorted(NEURAL_LANES)} — all delegated to "
            "mt_eval_harness",
            fix="for LYSS lanes add the plugin: `--plugin "
                "module.path:ClassName` on `nmt-forge score` / `compare`, or "
                "the config's eval.plugins (lanes are named "
                "'<plugin>:<key>'); forge delegates every metric and "
                "implements none",
        )
    out: dict[str, dict] = {}
    for m in scored_metrics:
        ci = conf.bootstrap_ci(
            entries, fns[m], n_bootstrap=n_bootstrap, alpha=alpha,
            seed=seed, metric_name=m,
        )
        out[m] = {
            "score": ci.score,
            "ci_lower": ci.ci_lower,
            "ci_upper": ci.ci_upper,
            "n_bootstrap": ci.n_bootstrap,
            "seed": seed,
            **lane_meta.get(m, {}),
        }
    return ScoreReport(n=len(entries), scores=out,
                       plugin_aggregates=plugin_aggregates, notes=notes)


def score_eval_set(
    workspace: Workspace,
    eval_set: str,
    hyps: list[str],
    *,
    config_hash: str | None = None,
    metrics: tuple[str, ...] = DEFAULT_METRICS,
    plugins: tuple = (),
    target_lang: str = "",
    n_bootstrap: int = 1000,
    seed: int = 12345,
    override_respend: str | None = None,
    prereg_id: str | None = None,
) -> ScoreReport:
    """The audited scoring path for a registered eval set.

    Order matters and is enforced: for test/sealed sets the preregistration
    gate runs BEFORE the set is read, so a refusal leaves no score-purpose
    read in the ledger.
    """
    entry = workspace.registry.get(eval_set)
    ident = _identity(workspace, eval_set)
    prereg_doc = None
    if entry["role"] in ("test", "sealed"):
        prereg_doc = preregister.require_prereg(
            workspace, eval_set, config_hash, prereg_id=prereg_id)
    rows = workspace.registry.open_eval(
        eval_set, "score", config_hash=config_hash,
        override_respend=override_respend,
        prereg_id=(prereg_doc or {}).get("id"),
    )
    refs = [str(r[entry["target_field"]]) for r in rows]
    sources = [str(r.get(entry["source_field"], "")) for r in rows]
    if len(hyps) != len(refs):
        raise ScoringError(
            f"{len(hyps)} hypotheses for {eval_set!r} with {len(refs)} rows",
            why="a partial decode scored as if complete flatters or damns the "
                "system depending on which rows are missing",
            fix="decode every row of the set, in file order, then score",
        )
    report = score(
        hyps, refs, sources, metrics=metrics, plugins=plugins,
        target_lang=target_lang, n_bootstrap=n_bootstrap, seed=seed,
    )
    report.eval_set = eval_set
    report.config_hash = config_hash
    report.dataset_id = ident["dataset_id"]
    report.dataset_id_source = ident["dataset_id_source"]
    workspace.ledger.append(
        "score", set=eval_set, config_hash=config_hash,
        metrics={m: round(s["score"], 4) for m, s in report.scores.items()},
        n=report.n,
    )
    if entry["role"] == "sealed":
        workspace.ledger.append("sealed-spend", set=eval_set, config_hash=config_hash)
    return report


@dataclass
class CompareReport:
    n: int
    labels: tuple[str, str]
    results: dict[str, dict] = field(default_factory=dict)
    eval_set: str | None = None
    plugin_aggregates: dict[str, dict] = field(default_factory=dict)  # name → {A: …, B: …}
    notes: dict[str, str] = field(default_factory=dict)
    dataset_id: str | None = None          # registry.dataset_identity
    dataset_id_source: str | None = None
    # per system label: the near-twin reading of its training data against
    # this eval set (compare_near_twin), and the caveats it implies — a
    # "winner" whose test rows are twinned in its training data won on
    # recall, not translation (Round 9)
    near_twin: dict[str, dict] = field(default_factory=dict)
    caveats: list[str] = field(default_factory=list)
    # per system label: the caveats mt-eval wrote on the TestReport of the
    # export that produced these hypotheses, verbatim (None: no export
    # matched, or its report carries none) — relayed in ``caveats`` too
    # (Round 13: a near-constant output compare never mentioned)
    score_caveats: dict[str, list | None] = field(default_factory=dict)

    def format(self) -> str:
        a, b = self.labels
        lines = [f"paired approximate randomization · n={self.n}"
                 + (f" · set={self.eval_set}" if self.eval_set else "")
                 + _dataset_suffix(self.eval_set, self.dataset_id)]
        for m, r in self.results.items():
            verdict = (f"significant, winner={r['winner']}"
                       if r["significant"] else "not significant")
            lines.append(
                f"  {m:<12} {a}={r['score_a']:.2f} {b}={r['score_b']:.2f} "
                f"Δ={r['delta']:+.2f} [{r['ci_lower']:+.2f}, {r['ci_upper']:+.2f}] "
                f"p={r['p_value']:.4f} → {verdict}"
            )
        for c in self.caveats:
            lines.append(f"  {c}")
        return "\n".join(lines)


def compare_near_twin(report: CompareReport,
                      sides: dict[str, dict | None],
                      harness_caveats: dict[str, list | None] | None = None
                      ) -> CompareReport:
    """Attach each system's near-twin reading and the caveats it implies.

    ``sides`` maps a label to the near-twin reading of that system's
    training data against the eval set — the SAME reading export and
    DEPLOY.md carry (``near_twin_summary`` from the export that produced the
    hypotheses, or the ``registered_near_twin_forecast`` of the run's
    training files) plus ``source`` (where it came from) — or None when
    forge cannot know what the system trained on. A system with near-twins
    gets the count; a system whose rows are MOSTLY twinned gets the export's
    caveat ("recall, not translation"), and a significant win by it is said
    not to be evidence it translates better (Round 9: `compare` printed
    `winner=all-data` while every test row had a twin in all-data's
    training set).

    ``harness_caveats`` maps a label to mt-eval's ``score_caveats`` on the
    export that wrote those hypotheses (``harness_caveats.for_export``):
    each is relayed beside the result in the harness's words, and a system
    with a MAJOR one is never said to "measure translation of unseen
    sentences", nor its win quoted without the caveat (Round 13)."""
    from ..harness_caveats import majors, short_label, text_lines

    labels = list(report.labels)
    report.near_twin = {}
    report.caveats = []
    harness_caveats = harness_caveats or {}
    report.score_caveats = {label: harness_caveats.get(label)
                            for label in labels}
    for label in labels:
        nt = sides.get(label)
        flagged = majors(harness_caveats.get(label))
        if not nt:
            report.near_twin[label] = {"checked": False, "known": False}
            report.caveats.append(
                f"{label}: near-twins not checked — forge does not know what "
                f"{label}'s model trained on (pass --run-{_side(report, label)} "
                "<its run-manifest.json>, or compare the hypotheses an export "
                "wrote: <export>/evaluation/battery-hyps.jsonl). If its "
                "training data shares sentence templates with this test set, "
                "its score carries template optimism")
            continue
        report.near_twin[label] = nt
        if not nt.get("checked"):
            report.caveats.append(f"{label}: near-twins not checked — "
                                  f"{nt.get('message', 'no reading')}")
            continue
        k, n = nt.get("near_twin_rows") or 0, nt.get("n") or report.n
        if not k:
            report.caveats.append(
                f"{label}: no test row has a near-twin in {label}'s training "
                "data — "
                + ("its score measures translation of unseen sentences"
                   if not flagged else
                   "its score is on unseen sentences, but mt-eval qualifies "
                   "it (" + ", ".join(short_label(c) for c in flagged)
                   + ", below): quote it only with that caveat")
                + (f" [{nt['source']}]" if nt.get("source") else ""))
            continue
        share = f"{k / n:.0%}" if n else "?"
        severe = bool(nt.get("recall_not_translation"))
        report.caveats.append(
            ("⚠ " if severe else "")
            + f"{label}: {k} of {n} test rows ({share}) have a near-twin in "
            f"{label}'s training data"
            + (" — its score measures recall of training phrases, not "
               "translation (export and DEPLOY.md say the same)"
               if severe else
               " — its score carries that much template optimism")
            + (f" [{nt['source']}]" if nt.get("source") else ""))
    # mt-eval's own caveats on each system's outputs, in its words
    for label in labels:
        report.caveats += text_lines(
            harness_caveats.get(label),
            prefix=f"{label} (mt-eval, on these outputs): ")
    for m, r in report.results.items():
        w = r.get("winner")
        if not r.get("significant") or w not in labels:
            continue
        flagged = majors(harness_caveats.get(w))
        if flagged:
            report.caveats.append(
                f"⚠ winner={w} on {m}: mt-eval puts a SCORE CAVEAT on "
                f"{w}'s outputs (" + ", ".join(short_label(c)
                                              for c in flagged)
                + ", above) — the win is a difference in a score mt-eval "
                "qualifies: never quote it without that caveat")
        nt = report.near_twin.get(w) or {}
        if nt.get("recall_not_translation"):
            report.caveats.append(
                f"⚠ winner={w} on {m} is NOT evidence that {w} translates "
                f"better: {nt.get('near_twin_rows')} of {nt.get('n')} test rows "
                f"are twinned in {w}'s training data, so it won on recall. "
                "Compare twin-free numbers instead — each export's strict "
                "subset (`nmt-forge report <run-manifest>`), or a model "
                "trained with --drop-test-twins — and never quote this "
                "winner alone"
                + ("; a twin-free number here carries mt-eval's SCORE "
                   "CAVEAT (above) — quote it only with that caveat"
                   if any(majors(harness_caveats.get(lb))
                          for lb in labels if lb != w) else ""))
    return report


def _side(report: CompareReport, label: str) -> str:
    return "a" if label == report.labels[0] else "b"


def compare(
    hyps_a: list[str],
    hyps_b: list[str],
    refs: list[str],
    sources: list[str] | None = None,
    *,
    labels: tuple[str, str] = ("A", "B"),
    metrics: tuple[str, ...] = ("chrf++",),
    plugins: tuple = (),
    target_lang: str = "",
    n_trials: int = 1000,
    n_bootstrap_ci: int = 1000,
    seed: int = 12345,
) -> CompareReport:
    """A-vs-B with the harness's paired AR test (its default system test).

    Plugin lanes are compared too: the lane's per-entry cache covers BOTH
    systems' entries, because the AR test scores hybrid lists that mix them.
    Neural lanes run inference once per system; for LOWER-is-better lanes
    (MetricX) the winner mapping flips with the direction.
    """
    sig = _harness.significance()
    fns = _metric_fns()
    entries_a = build_entries(hyps_a, refs, sources)
    entries_b = build_entries(hyps_b, refs, sources)
    report = CompareReport(n=len(refs), labels=labels)
    directions: dict[str, str] = {}
    scored_metrics: list[str] = []
    for m in metrics:
        if m in NEURAL_LANES:
            fn_a, meta_a = _attach_neural(m, entries_a, target_lang)
            if fn_a is None:
                report.notes[m] = meta_a
                continue
            fn_b, meta_b = _attach_neural(m, entries_b, target_lang)
            if fn_b is None:
                report.notes[m] = meta_b
                continue
            fns[m] = fn_a  # cached-mean fns are identical; scores ride entries
            directions[m] = NEURAL_LANES[m]["direction"]
        scored_metrics.append(m)
    for plugin in plugins:
        lane = PluginLane(plugin, entries_a)
        lane.extend(entries_b)
        report.plugin_aggregates[lane.name] = {
            labels[0]: lane.aggregate,
            labels[1]: lane.aggregate_for(entries_b),
        }
        lane_fns = lane.metric_fns()
        fns.update(lane_fns)
        scored_metrics.extend(lane_fns)
    for m in scored_metrics:
        res = sig.paired_approximate_randomization(
            entries_a, entries_b, fns[m], n_trials=n_trials, seed=seed,
            metric_name=m, n_bootstrap_ci=n_bootstrap_ci,
        )
        winner = res.winner  # harness convention: "A" iff delta > 0
        if winner is not None and directions.get(m) == "lower":
            winner = "B" if winner == "A" else "A"  # lower error wins
        report.results[m] = {
            "score_a": res.system_a_score,
            "score_b": res.system_b_score,
            "delta": res.delta,
            "p_value": res.p_value,
            "significant": res.significant,
            "winner": labels[0] if winner == "A" else
                      labels[1] if winner == "B" else winner,
            "ci_lower": res.ci_lower,
            "ci_upper": res.ci_upper,
            "method": res.method,
            **({"direction": directions[m]} if m in directions else {}),
        }
    return report


@dataclass
class BatteryReport:
    """Per-group (register) scoring of one registered eval set — the
    battery table, forge-shaped: every lane CI'd, plugin aggregates per
    group, a weighted ALL row, one ledgered read, one prereg gate."""

    eval_set: str
    by: str
    n: int
    groups: dict[str, ScoreReport] = field(default_factory=dict)
    weighted: dict = field(default_factory=dict)
    config_hash: str | None = None
    notes: dict[str, str] = field(default_factory=dict)
    # near-dupe lane: per-group clean-subset reports (entries with no
    # train-side near-twin) + the flagging metadata; empty when the lane is off
    strict_groups: dict[str, ScoreReport] = field(default_factory=dict)
    near_dupe: dict = field(default_factory=dict)
    # the clean subset across ALL groups (rows with no train-side near-twin)
    # — the generalization number next to the headline; None when the lane
    # is off, nothing was flagged, or every row was flagged
    strict_overall: ScoreReport | None = None
    # the preregistration the gate admitted this read under (test/sealed),
    # so the verdicts can be rendered from this very report
    prereg_id: str | None = None
    # how the gate chose that prereg (preregister.require_prereg)
    prereg_bound_by: str | None = None
    # the prereg was written after scoring reads (--allow-after-reads):
    # preregister.after_reads_info, said beside its verdicts — else None
    prereg_after_reads: dict | None = None
    # per-entry rows (id/source/expected/predicted/group) kept ONLY when the
    # caller asks (keep_entries=True) — the harness-RunLog bridge builds from
    # these so it needs no second read of the set. Never in to_manifest():
    # they carry eval text.
    entries: list[dict] = field(default_factory=list, repr=False)
    # the id mt-eval knows the set by (registry.dataset_identity);
    # eval_set stays forge's name (ledger, prereg, --eval-set)
    dataset_id: str | None = None
    dataset_id_source: str | None = None

    def format(self) -> str:
        lines = [f"battery: {self.eval_set}"
                 + _dataset_suffix(self.eval_set, self.dataset_id)
                 + f" · grouped by {self.by!r} · n={self.n}"]
        for name in sorted(self.groups):
            rep = self.groups[name]
            cells = []
            for m, s in rep.scores.items():
                cells.append(f"{m} {s['score']:.3g} "
                             f"[{s['ci_lower']:.3g},{s['ci_upper']:.3g}]")
            lines.append(f"  {name:<16} n={rep.n:<5} " + " · ".join(cells))
            if name in self.strict_groups:
                srep = self.strict_groups[name]
                cells = [f"{m} {s['score']:.3g} "
                         f"[{s['ci_lower']:.3g},{s['ci_upper']:.3g}]"
                         for m, s in srep.scores.items()]
                lines.append(f"  {name + ' (strict)':<16} n={srep.n:<5} "
                             + " · ".join(cells))
        if self.strict_overall is not None and len(self.groups) > 1:
            cells = [f"{m} {s['score']:.3g} "
                     f"[{s['ci_lower']:.3g},{s['ci_upper']:.3g}]"
                     for m, s in self.strict_overall.scores.items()]
            lines.append(f"  {'ALL (strict)':<16} n={self.strict_overall.n:<5} "
                         + " · ".join(cells))
        if self.near_dupe:
            flagged = self.near_dupe.get("flagged", 0)
            lines.append(
                f"  near-dupe lane: {flagged}/{self.n} rows have a "
                f"train-side near-twin (Jaccard ≥ "
                f"{self.near_dupe['params']['jaccard_threshold']}); "
                "strict rows exclude them — the gap between full and strict "
                "is the optimism bound")
            summary = near_twin_summary(self.to_manifest())
            if summary["recall_not_translation"]:
                lines.append(f"  ⚠ {summary['message']}")
                lines.append(f"    → {summary['advice']}")
        if self.weighted:
            cells = [f"{m} {v:.3g}" for m, v in self.weighted.items()
                     if isinstance(v, (int, float))]
            lines.append(f"  {'ALL (weighted)':<16} n={self.n:<5} "
                         + " · ".join(cells)
                         + "  (weighted mean — headline claims stay per-group)")
        for lane, reason in self.notes.items():
            lines.append(f"  {lane}: UNAVAILABLE — {reason}")
        return "\n".join(lines)

    def to_manifest(self) -> dict:
        return {
            "guard": "ci-scoring/battery",
            "eval_set": self.eval_set,
            "dataset_id": self.dataset_id or self.eval_set,
            "dataset_id_source": self.dataset_id_source,
            "by": self.by,
            "n": self.n,
            "config_hash": self.config_hash,
            "groups": {g: r.to_manifest() for g, r in self.groups.items()},
            "strict_groups": {g: r.to_manifest()
                              for g, r in self.strict_groups.items()},
            "near_dupe": {k: v for k, v in self.near_dupe.items()
                          if k != "indices"} if self.near_dupe else {},
            "strict_overall": (self.strict_overall.to_manifest()
                               if self.strict_overall is not None else None),
            "weighted": self.weighted,
            "notes": self.notes,
            "prereg": self.prereg_id,
            "prereg_bound_by": self.prereg_bound_by,
            "prereg_after_reads": self.prereg_after_reads,
        }


#: At or above this share of test rows with a train-side near-twin, a
#: battery score is read as RECALL OF TRAINING PHRASES, not translation —
#: DEPLOY.md, the export summary, the battery lint and the harness
#: TestReport all say so in those words.
RECALL_SHARE = 0.5

#: The near-twin threshold (token-set Jaccard) is ``leak_audit.
#: NEAR_TWIN_JACCARD`` (imported above): the battery's near-dupe lane, the
#: BEFORE-training forecast and ``leak-audit --drop-test-twins`` read the same
#: number, so the count a user is warned about before training is the count
#: export reports after it — and the rows the option drops.

#: The fix for a FIXED test set (teacher-written, registered — not carved by
#: split, so ``--near-dupe`` cannot reach it): one command, quoted wherever
#: the near-twin measure is reported.
DROP_TWINS_COMMAND = ("nmt-forge leak-audit <corpus> --clean-to "
                      "<corpus.notwins.jsonl> --drop-test-twins")

#: What to do about near-twins, said once wherever the measure is reported
#: before training (split, leak-audit, preflight run) — while the test set is
#: still unspent and the fix is still cheap.
NEAR_TWIN_ADVICE = (
    "fix it before training, while the test set is still unspent. Test set "
    "carved from your corpus: hold out whole templates (frames), so every "
    "sentence built on the same frame sits on ONE side — `nmt-forge split "
    "<corpus> --test N --dev M --seed S --out data/split --near-dupe "
    f"{NEAR_TWIN_JACCARD}` does exactly that. Test set a fixed, separate file "
    "(teacher-written, registered with --role test): drop the training rows "
    f"that are near-twins of its rows — `{DROP_TWINS_COMMAND}` says how many "
    "rows go and what the test score will then measure — and train on the "
    "cleaned file. Or get test sentences written independently of the "
    "training material (by someone who has not seen it) and register them "
    "as the test set (`nmt-forge registry add <name> <file> --role test`). "
    "Then run this check again")

#: How to choose when most test rows have a twin in training — said wherever
#: the near-twin warning appears (leak-audit, split, DEPLOY.md, NEXT_STEPS):
#: a school weighing "a useful model with an inflated score (all data)"
#: against "an honest score on a fraction of the data (twins dropped)".
TWIN_DECISION_NOTE = (
    "Choosing between the two models: the model trained on ALL the data is "
    "usually the more useful one to deploy — you may deploy it, but its test "
    "score is inflated by the twins; cite the twin-free score (the strict "
    "subset, or — when every test row has a twin — the score of a model "
    "trained with --drop-test-twins, labelled as that model's) as the "
    "measure of how it handles NEW sentences. Or train both and report both "
    "scores side by side. Never quote the inflated score alone")

#: Why a re-audit after splitting drops the dev rows, and how to avoid it.
AUDIT_BEFORE_SPLIT_NOTE = (
    "audit BEFORE splitting (as the guide says): run leak-audit on the "
    "corpus, then split the cleaned file. Once a dev set is registered, "
    "re-auditing the full corpus drops the dev set's own rows too (they "
    "match it), and re-splitting the cleaned file carves a NEW dev set — "
    "a rotation (`nmt-forge split … --register <prefix> --allow-rotate`)")


def near_dupe_carve_check(rows, *, source_field: str = "source",
                          target_field: str | None = None,
                          canonicalizer=None) -> dict:
    """Can ``split --near-dupe`` (at :data:`NEAR_TWIN_JACCARD`) hold out
    whole templates on these rows — or do the templates chain into one
    share-group, so the carve would refuse or hand that group to one side
    whole (``split_guard.near_dupe_chaining``)? Every near-twin advice
    reads it, so none recommends a carve that cannot work on the corpus.
    ``rows`` is the corpus (rows or a path); content-free result."""
    from .split_guard import near_dupe_chaining

    if isinstance(rows, (str, Path)):
        rows = load_rows(rows)
    if target_field is None:
        from ..canonical import detect_target_field

        try:
            target_field = detect_target_field(rows) if rows else "target"
        except KeyError:
            target_field = "target"
    return near_dupe_chaining(rows, threshold=NEAR_TWIN_JACCARD,
                              source_field=source_field,
                              target_field=target_field,
                              canonicalizer=canonicalizer)


def _chained(carve_check: dict | None) -> bool:
    return bool(carve_check and carve_check.get("checked")
                and carve_check.get("chained"))


def _cannot_near_dupe(carve_check: dict) -> str:
    return (f"`--near-dupe {NEAR_TWIN_JACCARD}` is no fix on this corpus: "
            f"{carve_check['message']}. A carve hands that group whole to "
            "one side — to dev or test it is refused (far more rows than "
            "asked), to training it leaves the carved sides without any of "
            "those sentences, so they are no sample of your data")


#: The routes that still work when the templates chain (no near-dupe carve).
_CHAINED_CARVE_ROUTES = (
    "or carve with capped groups — `--near-dupe {j} --max-group <N>` with N "
    "about half your smallest dev/test size (near-duplicate links beyond the "
    "cap stay uncut; the split counts them and reports the twins that cross "
    "sides) — or a higher threshold such as `--near-dupe 0.8` (fewer links, "
    "more twins left)").format(j=NEAR_TWIN_JACCARD)


def near_twin_advice(carve_check: dict | None = None) -> str:
    """:data:`NEAR_TWIN_ADVICE`, or — when ``carve_check``
    (:func:`near_dupe_carve_check`) says the templates chain — the same
    advice without the near-dupe carve that cannot work on this corpus."""
    if not _chained(carve_check):
        return NEAR_TWIN_ADVICE
    return (
        "fix it before training, while the test set is still unspent. "
        + _cannot_near_dupe(carve_check) + ". Test set a fixed, separate "
        "file (teacher-written, registered with --role test): drop the "
        "training rows that are near-twins of its rows — "
        f"`{DROP_TWINS_COMMAND}` says how many rows go and what the test "
        "score will then measure — and train on the cleaned file. Test set "
        "carved from your corpus: get test sentences written independently "
        "of the training material (by someone who has not seen it) and "
        "register them as the test set (`nmt-forge registry add <name> "
        "<file> --role test`), " + _CHAINED_CARVE_ROUTES + ". Then run this "
        "check again")


def near_twin_advice_after(carve_check: dict | None = None) -> str:
    """:data:`NEAR_TWIN_ADVICE_AFTER`, tailored like :func:`near_twin_advice`."""
    if not _chained(carve_check):
        return NEAR_TWIN_ADVICE_AFTER
    return (
        "for a test score that measures translation: when the test set is a "
        "fixed, separate file (registered, not carved from your corpus), "
        f"drop the training rows that are near-twins of it — "
        f"`{DROP_TWINS_COMMAND}` says how many go and what the score will "
        "then measure — and retrain on the cleaned file (this test set has "
        "been scored once, so preregister the new run with `nmt-forge prereg "
        "new <id> --eval-set <set> --predictions <file> --allow-after-reads`; "
        "the ledger records both reads). Test set carved from your corpus: "
        + _cannot_near_dupe(carve_check) + "; get test sentences written "
        "independently of the training material and register them as a new "
        "test set, " + _CHAINED_CARVE_ROUTES)


#: What a dev set whose rows have a twin in training MEANS — one clause,
#: said by every reading of the dev near-twin measure (:func:`dev_twin_verdict`).
DEV_TWIN_MEANING = (
    "checkpoint selection on it measures recall of training phrases, not "
    "translation: it picks the checkpoint that repeats training sentences "
    "best, and a saturated dev score (nothing to choose between) is likely")

#: The states :func:`dev_twin_verdict` returns. ``final`` ones are forge's
#: last word on the corpus: no further split changes them, so they are
#: relayed once and never as a step to follow.
DEV_TWIN_STATES = ("re-split", "capped", "no-split-fixes")


def _capped_text(capped: dict) -> str:
    return (f"the near-duplicate links --max-group {capped['max_group']} "
            f"left uncut ({capped.get('uncut') or 0} of "
            f"{capped.get('links') or 0} links)")


def dev_twin_verdict(carve_check: dict | None = None, *,
                     dev_name: str | None = None,
                     capped: dict | None = None) -> dict:
    """THE verdict on a dev set whose rows have a near-twin in training —
    one function, read by split, ``preflight run``, ``status`` and the run's
    saturation note, so the four never disagree (Round 11 school persona:
    split kept saying "follow the advice before training" after the advice
    had been followed, on a corpus no split can fix).

    ``carve_check`` is :func:`near_dupe_carve_check` of what a re-split
    would carve; ``capped`` = ``{max_group, links, uncut}`` when the dev side
    came from a ``--max-group`` carve. Content-free ``{state, final,
    headline, meaning, options, advice}``:

    - ``re-split``: ``--near-dupe`` can hold out whole templates here — do
      it (``final`` False);
    - ``capped``: a capped carve left uncut links; a larger cap or the plain
      ``--near-dupe`` carve can still cut them (``final`` False);
    - ``no-split-fixes``: the templates chain, so no split gives a twin-free
      dev set that is a sample of the data — said once, with what it means
      and the options forge really has (``final`` True)."""
    if not _chained(carve_check):
        if capped:
            advice = (
                f"these near-twins are {_capped_text(capped)}: a larger cap "
                "cuts more of them but makes bigger groups (split refuses a "
                "carve whose side gets far more rows than asked); for a set "
                "with no twins, write its sentences independently of the "
                "training material and register them (`nmt-forge registry "
                "add <name> <file> --role dev|test --allow-rotate`)")
            return {"state": "capped", "final": False, "headline": advice,
                    "meaning": DEV_TWIN_MEANING, "options": [advice],
                    "advice": advice}
        return {"state": "re-split", "final": False,
                "headline": DEV_TWIN_ADVICE, "meaning": DEV_TWIN_MEANING,
                "options": [DEV_TWIN_ADVICE], "advice": DEV_TWIN_ADVICE}
    name = dev_name or "<dev set>"
    cap = ("A capped carve: you ran one — these twins are "
           + _capped_text(capped) + "; a larger cap cuts more of them and "
           "makes bigger groups" if capped else
           f"A capped carve (`--near-dupe {NEAR_TWIN_JACCARD} --max-group "
           "<about half the dev size> --allow-rotate`) holds out template "
           "groups of up to that size: it lowers the share (the split "
           "counts what is left)")
    options = [
        "Accept it and train: dev then only picks the checkpoint — judge "
        "translation by a test score on sentences with no twin in training "
        "(the twin-free model's score, or the strict subset export reports), "
        "never by the dev score",
        "Write dev sentences independently of the training material (by "
        "someone who has not seen it) and register them in place of the "
        f"carved ones: `nmt-forge registry add {name} <file> --role dev "
        "--allow-rotate` (config.json keeps its data.dev)",
        cap + ", but no cap reaches zero while dev is a sample of your "
        "data"]
    headline = ("no split fixes this dev set: "
                + _cannot_near_dupe(carve_check))
    advice = (f"{headline}. What a twinned dev set means: {DEV_TWIN_MEANING}"
              ". Your options: "
              + " ".join(f"({i}) {o}." for i, o in enumerate(options, 1))
              + " This is forge's verdict on the corpus, not a step to "
              "repeat: re-splitting will not change it")
    return {"state": "no-split-fixes", "final": True, "headline": headline,
            "meaning": DEV_TWIN_MEANING, "options": options, "advice": advice}


def apply_dev_twin_verdict(forecast: dict | None,
                           carve_check: dict | None = None, *,
                           dev_name: str | None = None,
                           capped: dict | None = None) -> dict | None:
    """Put :func:`dev_twin_verdict` on a :func:`dev_near_twin_forecast`
    result in place (``verdict``, ``advice``, the carve check when the
    templates chain) and return it — None when no dev row is twinned."""
    if not forecast or not forecast.get("near_twin_rows"):
        return None
    v = dev_twin_verdict(carve_check, dev_name=dev_name, capped=capped)
    forecast["verdict"] = v
    forecast["advice"] = v["advice"]
    if _chained(carve_check):
        forecast["near_dupe_carve_check"] = carve_check
    return v


def dev_twin_advice(carve_check: dict | None = None, *,
                    dev_name: str | None = None,
                    capped: dict | None = None) -> str:
    """:func:`dev_twin_verdict`'s advice text (``DEV_TWIN_ADVICE`` where a
    ``--near-dupe`` re-split can work)."""
    return dev_twin_verdict(carve_check, dev_name=dev_name,
                            capped=capped)["advice"]


def dev_saturation_advice(carve_check: dict | None = None) -> str:
    """:data:`DEV_SATURATION_ADVICE`; on a corpus whose templates chain, the
    dev twin verdict itself (:func:`dev_twin_verdict` — the same words split,
    preflight and status say)."""
    if not _chained(carve_check):
        return DEV_SATURATION_ADVICE
    return dev_twin_verdict(carve_check)["advice"]


def near_twin_headline(forecasts: dict[str, dict]) -> dict | None:
    """The worst near-twin forecast among ``forecasts`` (a
    :func:`registered_near_twin_forecast` mapping), as ``{set, n,
    near_twin_rows, share, strict_n, severe, message}`` — None when no set
    was checked. ``severe`` = most test rows twinned (the score would
    measure recall, not translation)."""
    checked = {n: f for n, f in (forecasts or {}).items()
               if f.get("checked") and f.get("n")}
    if not checked:
        return None
    name, f = max(checked.items(),
                  key=lambda kv: (kv[1].get("near_twin_share") or 0, kv[0]))
    return {"set": name, "n": f["n"], "near_twin_rows": f["near_twin_rows"],
            "share": f["near_twin_share"], "strict_n": f["strict_n"],
            "severe": bool(f.get("recall_not_translation")),
            "message": f["message"]}


#: The same advice AFTER scoring (export, the battery report and its lint):
#: the test set has been read once, so a retrained model's score is a
#: second, ledgered read.
NEAR_TWIN_ADVICE_AFTER = (
    "for a test score that measures translation: when the test set is a "
    "fixed, separate file (registered, not carved from your corpus), drop "
    f"the training rows that are near-twins of it — `{DROP_TWINS_COMMAND}` "
    "says how many go and what the score will then measure — and retrain on "
    "the cleaned file (this test set has been scored once, so preregister "
    "the new run with `nmt-forge prereg new <id> --eval-set <set> "
    "--predictions <file> --allow-after-reads`; the ledger records both "
    "reads); or get test sentences written independently of the training "
    "material and register them as a new test set. Test set carved from "
    f"your corpus: re-split with `--near-dupe {NEAR_TWIN_JACCARD}` (whole "
    "templates on one side)")


def near_twin_summary(manifest: dict, metric: str = "chrf++", *,
                      before_training: bool = False) -> dict:
    """What the near-dupe lane says about a battery manifest's headline —
    the ONE reading every surface (export summary, DEPLOY.md,
    forge-model.json, the harness TestReport, battery-lint) prints, so the
    caveat travels with the number instead of staying in the battery file.

    Returns ``{checked, n, near_twin_rows, near_twin_share,
    jaccard_threshold, strict_n, strict (the clean-subset score of
    ``metric`` with its CI, or None), recall_not_translation, message,
    advice}`` — ``advice`` (:data:`NEAR_TWIN_ADVICE_AFTER`; None when no row
    has a twin) says how to get a number that measures translation.

    ``before_training=True`` is the same reading of the same count, said
    while it can still be acted on (see :func:`near_twin_forecast`): the
    message is about the score the test set WILL produce, and the result
    adds ``when: "before-training"`` and ``advice`` (what to do; None when
    no row has a twin). ``strict`` is None — nothing has been scored.
    """
    if before_training:
        return _near_twin_forecast_reading(manifest)
    n = int(manifest.get("n") or 0)
    nd = manifest.get("near_dupe") or {}
    if not nd or not n:
        return {
            "checked": False, "n": n, "near_twin_rows": None,
            "near_twin_share": None, "jaccard_threshold": None,
            "strict_n": None, "strict": None,
            "recall_not_translation": False, "advice": None,
            "message": ("near-twin check not run (set eval.near_dupe_corpus "
                        "to the training file) — if training and test share "
                        "sentence templates, this score carries template "
                        "optimism and nothing here measures how much"),
        }
    flagged = int(nd.get("flagged") or 0)
    share = flagged / n
    strict_doc = manifest.get("strict_overall")
    if strict_doc is None:
        sg = manifest.get("strict_groups") or {}
        if len(manifest.get("groups") or {}) == 1 and len(sg) == 1:
            strict_doc = next(iter(sg.values()))
    strict = ((strict_doc or {}).get("scores") or {}).get(metric)
    strict_n = n - flagged
    pct = f"{share:.0%}"
    thr = (nd.get("params") or {}).get("jaccard_threshold")
    if strict and metric == "chrf++":
        # chrF++ as the scoring standard writes it (standard/1)
        from ..scoring_standard import scoring

        strict_score = scoring().format_primary(
            strict["score"], strict.get("ci_lower"), strict.get("ci_upper"))
    elif strict:
        strict_score = (f"{metric} {strict['score']:.2f} "
                        f"[{strict['ci_lower']:.2f}, "
                        f"{strict['ci_upper']:.2f}]")
    strict_txt = (f"; the strict score (the {strict_n} rows with no "
                  f"train-side near-twin) is {strict_score} — "
                  "that is the generalization number"
                  if strict else "")
    if flagged == n:
        message = (f"all {n} test rows have a near-identical twin in the "
                   "training data — there is no clean subset to score: this "
                   "score measures recall of training phrases, not "
                   "translation")
    elif share >= RECALL_SHARE:
        message = (f"{flagged} of {n} test rows ({pct}) have a "
                   "near-identical twin in the training data — this score "
                   "mostly measures recall of training phrases, not "
                   "translation" + strict_txt)
    elif flagged:
        message = (f"{flagged} of {n} test rows ({pct}) have a near-twin in "
                   "the training data" + strict_txt)
    else:
        message = ("no test row has a near-twin in the training data "
                   f"(Jaccard ≥ {thr})")
    return {
        "checked": True, "n": n, "near_twin_rows": flagged,
        "near_twin_share": round(share, 4), "jaccard_threshold": thr,
        "strict_n": strict_n, "strict": strict,
        "recall_not_translation": share >= RECALL_SHARE,
        "advice": (near_twin_advice_after(nd.get("carve_check"))
                   if flagged else None),
        **({"near_dupe_carve_check": nd["carve_check"]}
           if nd.get("carve_check") else {}),
        "message": message,
    }


def _near_twin_forecast_reading(manifest: dict) -> dict:
    """near_twin_summary's before-training wording (same fields, same
    thresholds; the score it talks about does not exist yet)."""
    n = int(manifest.get("n") or 0)
    nd = manifest.get("near_dupe") or {}
    thr = (nd.get("params") or {}).get("jaccard_threshold")
    if not n:
        return {"checked": False, "when": "before-training", "n": 0,
                "near_twin_rows": None, "near_twin_share": None,
                "jaccard_threshold": thr, "strict_n": None, "strict": None,
                "recall_not_translation": False, "advice": None,
                "message": "the test set is empty — nothing to check"}
    flagged = int(nd.get("flagged") or 0)
    share = flagged / n
    strict_n = n - flagged
    pct = f"{share:.0%}"
    if flagged == n:
        message = (f"all {n} test rows have a near-identical twin in the "
                   "training data — the strict subset (test rows with no "
                   "twin) will be EMPTY, so the test score will measure "
                   "recall of training phrases, not translation")
    elif share >= RECALL_SHARE:
        message = (f"{flagged} of {n} test rows ({pct}) have a "
                   "near-identical twin in the training data — the test "
                   "score will mostly measure recall of training phrases, "
                   f"not translation; only {strict_n} row(s) would be left "
                   "to measure translation (the strict subset)")
    elif flagged:
        message = (f"{flagged} of {n} test rows ({pct}) have a near-twin in "
                   "the training data — after training, the strict score on "
                   f"the other {strict_n} rows is the generalization number "
                   "(export reports it next to the full score)")
    else:
        message = ("no test row has a near-twin in the training data "
                   f"(Jaccard ≥ {thr}) — the test score will measure "
                   "translation of unseen sentences")
    return {
        "checked": True, "when": "before-training", "n": n,
        "near_twin_rows": flagged, "near_twin_share": round(share, 4),
        "jaccard_threshold": thr, "strict_n": strict_n, "strict": None,
        "recall_not_translation": share >= RECALL_SHARE,
        "advice": (near_twin_advice(nd.get("carve_check"))
                   if flagged else None),
        **({"near_dupe_carve_check": nd["carve_check"]}
           if nd.get("carve_check") else {}),
        "message": message,
    }


def near_twin_forecast(eval_rows: list[dict], corpus, *,
                       eval_source_field: str = "source",
                       eval_target_field: str | None = None,
                       source_field: str = "source",
                       target_field: str | None = None,
                       canonicalizer=None,
                       jaccard_threshold: float = NEAR_TWIN_JACCARD,
                       carve_check: dict | None = None) -> dict:
    """BEFORE training: what share of the test rows have a near-twin in the
    training data, and what that will do to the test score.

    ``carve_check`` (:func:`near_dupe_carve_check` of the corpus) tailors
    the advice when the corpus's templates chain.

    The same measure export applies after scoring (``leak_audit.
    near_twin_flags`` at the battery's threshold) read by the same function
    (:func:`near_twin_summary`), so the number a user is warned about here is
    the number export prints later — said while the test set is unspent and
    holding out whole templates is still possible. Content-free: counts and
    shares only.
    """
    from .leak_audit import near_twin_flags

    if not eval_rows:
        return near_twin_summary({"n": 0}, before_training=True)
    flags = near_twin_flags(
        eval_rows, corpus, jaccard_threshold=jaccard_threshold,
        canonicalizer=canonicalizer, source_field=source_field,
        target_field=target_field, eval_source_field=eval_source_field,
        eval_target_field=eval_target_field)
    return near_twin_summary(
        {"n": len(eval_rows),
         "near_dupe": {"flagged": len(flags["indices"]),
                       "params": flags["params"],
                       **({"carve_check": carve_check}
                          if carve_check else {})}},
        before_training=True)


def registered_near_twin_forecast(workspace: Workspace, corpus, *,
                                  roles: tuple[str, ...] = ("test", "sealed"),
                                  source_field: str = "source",
                                  target_field: str | None = None,
                                  canonicalizer=None,
                                  names: list[str] | None = None,
                                  carve_check: dict | None = None
                                  ) -> dict[str, dict]:
    """:func:`near_twin_forecast` for every registered test/sealed set (or
    the ``names`` given) against ``corpus`` (rows or a path). Each set is
    read through the registry's audited path (purpose ``audit`` — ledgered,
    never a spend), exactly like leak-audit's own screen."""
    if isinstance(corpus, (str, Path)):
        corpus = load_rows(corpus)
    out: dict[str, dict] = {}
    for name in (names if names is not None
                 else workspace.registry.names(roles=roles)):
        entry = workspace.registry.get(name)
        rows = workspace.registry.open_eval(name, "audit")
        out[name] = {"role": entry["role"], **near_twin_forecast(
            rows, corpus, eval_source_field=entry["source_field"],
            eval_target_field=entry["target_field"],
            source_field=source_field, target_field=target_field,
            canonicalizer=canonicalizer, carve_check=carve_check)}
    return out


#: The most each built-in lane can score — the ceiling the dev-saturation
#: check measures against. Lanes without a fixed maximum (neural, plugin,
#: lower-is-better) are never called saturated.
METRIC_CEILINGS = {"chrf++": 100.0, "bleu": 100.0, "exact_match": 1.0}

#: A dev score is SATURATED when its 95% CI's LOWER bound is at or above
#: this share of the metric's ceiling (chrF++ ≥ 99.0, exact match ≥ 0.99).
#: Then at most 1% of the scale lies above everything the dev set can
#: plausibly say, so no checkpoint can be shown better than another by more
#: than a point — and the interval collapses to a single point when every
#: dev row is reproduced exactly. Selection had nothing to choose between.
SATURATION_SHARE = 0.99

#: What to do about a saturated dev set — said wherever the warning is
#: (run output, run report, status, export, DEPLOY.md).
DEV_SATURATION_ADVICE = (
    "make the dev set able to tell checkpoints apart: re-split holding out "
    "whole templates, so no dev row has a template twin in training — "
    "`nmt-forge split <corpus> --test <M|0> --dev <N> --seed <S> --out "
    f"data/split --register project --near-dupe {NEAR_TWIN_JACCARD} "
    "--allow-rotate` (the dev set is registered, so the re-split is a "
    "ledgered rotation); `nmt-forge leak-audit <training file> --clean-to "
    "<clean.jsonl>` drops the training rows that near-duplicate a dev "
    "answer, but keeps template siblings, which only the --near-dupe "
    "re-split separates; or write dev sentences independently of the "
    "training material and register them (`nmt-forge registry add <name> "
    "<file> --role dev --allow-rotate`). Then train again — dev is "
    "iteration data, re-reading it spends nothing")


def dev_saturation(scores: dict | None, *, n: int | None = None,
                   selection: dict | None = None,
                   carve_check: dict | None = None) -> dict | None:
    """Is the dev score SATURATED (:data:`SATURATION_SHARE`)? ``None`` when
    no lane is; else ``{saturated: True, metrics: {lane: {score, ci,
    ceiling, degenerate_ci}}, bound, tied_candidates, candidates, message,
    advice}``.

    ``selection`` is a stage's checkpoint-selection manifest: when every
    candidate scored the same, the pick was the first in loss order, not a
    better model — said in ``tied_candidates``. Content-free."""
    sat: dict[str, dict] = {}
    for m, s in (scores or {}).items():
        ceiling = METRIC_CEILINGS.get(m)
        if (ceiling is None or not isinstance(s, dict)
                or s.get("direction") == "lower"
                or not isinstance(s.get("ci_lower"), (int, float))):
            continue
        lo = float(s["ci_lower"])
        hi = float(s.get("ci_upper", lo))
        if lo >= SATURATION_SHARE * ceiling:
            sat[m] = {"score": s.get("score"), "ci": [lo, hi],
                      "ceiling": ceiling, "degenerate_ci": hi - lo <= 1e-9}
    if not sat:
        return None
    tied = cands = None
    sel_metric = None
    if selection and str(selection.get("metric", "")).startswith(
            "generation:"):
        sel_metric = selection["metric"].split(":", 1)[1]
        rows = [r for r in selection.get("per_checkpoint") or []
                if isinstance(r.get(sel_metric), (int, float))]
        if rows:
            top = rows[0][sel_metric]
            cands = len(rows)
            tied = sum(abs(r[sel_metric] - top) <= 1e-9 for r in rows)
    head_m = sel_metric if sel_metric in sat else next(iter(sat))
    h = sat[head_m]
    shown = (f"{h['score']:.2f}" if h["ceiling"] > 1
             else f"{h['score']:.3f}")
    ci = (f"[{h['ci'][0]:.2f}, {h['ci'][1]:.2f}]" if h["ceiling"] > 1
          else f"[{h['ci'][0]:.3f}, {h['ci'][1]:.3f}]")
    others = [m for m in sat if m != head_m]
    msg = (f"the dev set is SATURATED: {head_m} {shown} {ci}"
           + (f" on n={n}" if n else "")
           + (f" (also {', '.join(others)})" if others else "")
           + f" — the 95% CI's lower bound is at or above "
             f"{SATURATION_SHARE:.0%} of the metric's maximum"
           + (", and the interval is a single point" if h["degenerate_ci"]
              else "") + ". ")
    if tied and cands and tied == cands and cands > 1:
        msg += (f"Checkpoint selection had nothing to choose between: all "
                f"{cands} candidates scored the same, so the pick is the "
                "first in dev-loss order, not a better model. ")
    elif tied and tied > 1:
        msg += (f"Checkpoint selection had nothing to choose between at the "
                f"top: {tied} of {cands} candidates tied at the ceiling, so "
                "the pick among them is the first in dev-loss order, not a "
                "better model. ")
    else:
        msg += ("Checkpoint selection could not tell checkpoints apart by "
                "more than a point. ")
    msg += ("A perfect dev score usually means dev rows have near-twins in "
            "the training data; it does not mean the model is perfect — "
            "the test score (and its twin-free strict score) is the measure")
    return {"saturated": True, "metrics": sat,
            "bound": (f"95% CI lower bound ≥ {SATURATION_SHARE:.0%} of the "
                      "metric's maximum (chrF++/BLEU ≥ "
                      f"{SATURATION_SHARE * 100:g}, exact match ≥ "
                      f"{SATURATION_SHARE:g})"),
            "tied_candidates": tied, "candidates": cands,
            "message": msg, "advice": dev_saturation_advice(carve_check),
            **({"near_dupe_carve_check": carve_check}
               if _chained(carve_check) else {})}


def run_dev_saturation(manifest: dict) -> dict | None:
    """:func:`dev_saturation` for a run manifest: the recorded reading when
    the run wrote one, else measured from its dev report and last stage's
    selection (manifests written before 2026-10-04)."""
    if "dev_saturation" in manifest:
        return manifest["dev_saturation"]
    dev = manifest.get("dev_report") or {}
    stages = manifest.get("stages") or []
    return dev_saturation(dev.get("scores"), n=dev.get("n"),
                          selection=(stages[-1].get("selection")
                                     if stages else None))


def render_dev_saturation(sat: dict | None, *, prefix: str = "") -> list[str]:
    """The warning lines (empty when the dev set is not saturated)."""
    if not sat:
        return []
    return [f"{prefix}⚠ {_sentence_case(sat['message'])}.",
            f"{prefix}  → {sat['advice']}"]


def _sentence_case(text: str) -> str:
    text = text.strip().rstrip(".")
    return text[:1].upper() + text[1:]


def dev_near_twin_forecast(dev_rows: list[dict], train_rows, *,
                           dev_source_field: str = "source",
                           dev_target_field: str | None = None,
                           source_field: str = "source",
                           target_field: str | None = None,
                           canonicalizer=None,
                           carve_check: dict | None = None) -> dict:
    """The near-twin measure the test forecast uses (``leak_audit.
    near_twin_flags`` at :data:`NEAR_TWIN_JACCARD`), for the DEV set: dev
    rows with a near-twin on the training side. A group-disjoint split
    shares no exact source/target key across sides, but template siblings
    ("I see the dog" / "I see the cat") do cross it — and every dev row with
    a twin in training makes checkpoint selection optimistic. Content-free:
    ``{checked, n, near_twin_rows, near_twin_share, jaccard_threshold,
    severe, message, advice}`` (``severe`` = most dev rows twinned)."""
    from .leak_audit import near_twin_flags

    if not dev_rows or not train_rows:
        return {"checked": False, "n": len(dev_rows or []),
                "near_twin_rows": None, "near_twin_share": None,
                "jaccard_threshold": NEAR_TWIN_JACCARD, "severe": False,
                "advice": None, "verdict": None,
                "message": "nothing to compare (no dev or no training rows)"}
    flags = near_twin_flags(
        dev_rows, train_rows, jaccard_threshold=NEAR_TWIN_JACCARD,
        canonicalizer=canonicalizer, source_field=source_field,
        target_field=target_field, eval_source_field=dev_source_field,
        eval_target_field=dev_target_field)
    n, k = len(dev_rows), len(flags["indices"])
    share = k / n
    if not k:
        msg = ("no dev row has a near-twin in the training data (Jaccard ≥ "
               f"{NEAR_TWIN_JACCARD}) — checkpoint selection measures unseen "
               "sentences")
    else:
        msg = (f"{k} of {n} dev rows ({share:.0%}) have a near-twin in the "
               f"training data (Jaccard ≥ {NEAR_TWIN_JACCARD}; the split "
               "shares no exact sentence, but template siblings cross it) — "
               "checkpoint selection on dev will be optimistic"
               + (", and a saturated dev score (nothing to choose between) "
                  "is likely" if share >= RECALL_SHARE else ""))
    verdict = dev_twin_verdict(carve_check) if k else None
    return {"checked": True, "n": n, "near_twin_rows": k,
            "near_twin_share": round(share, 4),
            "jaccard_threshold": NEAR_TWIN_JACCARD,
            "severe": share >= RECALL_SHARE,
            "advice": verdict["advice"] if verdict else None,
            "verdict": verdict,
            **({"near_dupe_carve_check": carve_check}
               if k and _chained(carve_check) else {}),
            "message": msg}


#: What to do about dev rows with a twin in training (split, preflight).
DEV_TWIN_ADVICE = (
    "for a dev set that can tell checkpoints apart, carve it with whole "
    "templates on one side: add `--near-dupe "
    f"{NEAR_TWIN_JACCARD}` to the split (with `--allow-rotate` once the dev "
    "set is registered); `nmt-forge leak-audit <training file> --clean-to "
    "<clean.jsonl>` drops only the training rows that near-duplicate a dev "
    "answer")


def render_near_twin_forecast(forecasts: dict[str, dict], *,
                              decision: bool = True) -> list[str]:
    """Plain-language lines for :func:`registered_near_twin_forecast` (or a
    ``{label: near_twin_forecast(...)}`` mapping): one per set, then the
    advice once — and, when most test rows are twinned, how to choose
    between an all-data model and a twin-free one (:data:`TWIN_DECISION_NOTE`;
    ``decision=False`` when the caller already printed it)."""
    if not forecasts:
        return []
    lines = ["TEST ROWS WITH A NEAR-TWIN IN THE TRAINING DATA (what your test "
             "score will measure):"]
    advice = None
    severe = False
    for name, f in forecasts.items():
        mark = "⚠ " if f.get("recall_not_translation") else ""
        severe = severe or bool(f.get("recall_not_translation"))
        lines.append(f"  {mark}{name}: {f['message']}")
        advice = advice or f.get("advice")
    if advice:
        lines.append(f"  → {advice}")
    if severe and decision:
        lines.append(f"  → {TWIN_DECISION_NOTE}")
    return lines


def _align_hyps(rows: list[dict], hyps, eval_set: str) -> list[str]:
    """Positional (list[str], exact length) or id-aligned (list[dict] with
    'id' + 'hypothesis'/'predicted') — loud on any mismatch."""
    if hyps and isinstance(hyps[0], dict):
        field_name = next((f for f in ("hypothesis", "predicted")
                           if all(f in h for h in hyps)), None)
        if field_name is None or not all("id" in h for h in hyps):
            raise ScoringError(
                f"hypothesis rows for {eval_set!r} need uniform 'id' and "
                "'hypothesis'/'predicted' fields",
                fix="decode the registered set and keep each row's id",
            )
        by_id = {h["id"]: str(h[field_name]) for h in hyps}
        missing = [r.get("id") for r in rows if r.get("id") not in by_id]
        if missing:
            raise ScoringError(
                f"{len(missing)} eval rows have no hypothesis (first: "
                f"{missing[:3]})",
                why="a partial decode scored as if complete flatters or damns "
                    "the system depending on which rows are missing",
                fix="decode every row of the set, then score",
            )
        extra = set(by_id) - {r.get("id") for r in rows}
        if extra:
            raise ScoringError(
                f"{len(extra)} hypothesis ids not in {eval_set!r} "
                f"(first: {sorted(extra)[:3]})",
                fix="score against the set these hypotheses were decoded from",
            )
        return [by_id[r.get("id")] for r in rows]
    if len(hyps) != len(rows):
        raise ScoringError(
            f"{len(hyps)} hypotheses for {eval_set!r} with {len(rows)} rows",
            fix="decode every row of the set, in file order, then score — or "
                "pass id-keyed hypothesis rows",
        )
    return [str(h) for h in hyps]


def score_battery(
    workspace: Workspace,
    eval_set: str,
    hyps,
    *,
    by: str = "register",
    metrics: tuple[str, ...] = ("chrf++",),
    plugins: tuple = (),
    conventions=None,
    canonicalizer=None,
    target_lang: str = "",
    n_bootstrap: int = 1000,
    seed: int = 12345,
    alpha: float = 0.05,
    config_hash: str | None = None,
    override_respend: str | None = None,
    near_dupe_corpus=None,
    near_dupe_jaccard: float = NEAR_TWIN_JACCARD,
    keep_entries: bool = False,
    prereg_id: str | None = None,
) -> BatteryReport:
    """The battery: one registered set, scored per ``by``-group.

    Faithful to the reference battery's boundary rules: ``canonicalizer``
    (the pack's orthography normalization) applies to hypotheses AND
    references before similarity metrics — while plugin/convention lanes can
    read the RAW text (entries carry ``predicted_raw``/``expected_raw``),
    because mixed-convention is measured on what the model actually emitted.
    One prereg gate, one ledgered read, plugin inference once across all
    groups.

    ``near_dupe_corpus`` (rows or a path — normally the TRAIN file) turns on
    the near-dupe lane (crk finding, 2026-07-12: 37/659 battery rows were
    ≥0.6-Jaccard rewordings of gold train drills — exact overlap zero, the
    group-disjoint carve cannot remove rewordings). The frozen set is scored
    UNCHANGED; each group additionally gets a "(strict)" clean-subset row
    excluding flagged entries, so the full-vs-strict gap is a visible
    optimism bound rather than a silent one. Deliberate minimal pairs in
    training remain legitimate — this lane measures their effect, it does
    not forbid them.
    """
    conf = _harness.confidence()
    entry_meta = workspace.registry.get(eval_set)
    ident = _identity(workspace, eval_set)
    prereg_doc = None
    if entry_meta["role"] in ("test", "sealed"):
        # which prereg THIS run is judged against: explicit, the only one,
        # the one its first read was admitted under, or the one pinned to its
        # config — never "the newest" (preregister.require_prereg)
        prereg_doc = preregister.require_prereg(workspace, eval_set,
                                                config_hash,
                                                prereg_id=prereg_id)
    rows = workspace.registry.open_eval(
        eval_set, "score", config_hash=config_hash,
        override_respend=override_respend,
        prereg_id=(prereg_doc or {}).get("id"),
    )
    hyp_texts = _align_hyps(rows, hyps, eval_set)
    src_f, tgt_f = entry_meta["source_field"], entry_meta["target_field"]

    flagged_idx: set[int] = set()
    near_dupe_meta: dict = {}
    if near_dupe_corpus is not None:
        from .leak_audit import near_twin_flags

        flags = near_twin_flags(
            rows, near_dupe_corpus,
            jaccard_threshold=near_dupe_jaccard,
            canonicalizer=canonicalizer,
            eval_source_field=src_f, eval_target_field=tgt_f,
        )
        flagged_idx = flags["indices"]
        near_dupe_meta = {
            "flagged": len(flagged_idx),
            "flagged_ids": sorted(
                str(rows[i].get("id", i)) for i in flagged_idx),
            "params": flags["params"],
        }
        if flagged_idx:
            # the advice every surface prints with this manifest names the
            # near-dupe re-split only where it can work on this corpus
            near_dupe_meta["carve_check"] = near_dupe_carve_check(
                near_dupe_corpus, canonicalizer=canonicalizer)

    # a set with no `by` field at all is ONE group, named "all" — not "?"
    by_absent = not any(by in r for r in rows)
    entries: list[dict] = []
    for i, (row, hyp) in enumerate(zip(rows, hyp_texts)):
        ref_raw = str(row[tgt_f])
        pred = canonicalizer(hyp) if canonicalizer else hyp
        ref = canonicalizer(ref_raw) if canonicalizer else ref_raw
        entries.append({
            "id": row.get("id", i),
            "source": str(row.get(src_f, "")),
            "expected": ref,
            "predicted": pred,
            "predicted_raw": hyp,
            "expected_raw": ref_raw,
            "error": None,
            "exact_match": pred.strip() == ref.strip(),
            "_group": "all" if by_absent else str(row.get(by, "?")),
            "_near_dupe": i in flagged_idx,
        })

    fns = _metric_fns()
    notes: dict[str, str] = {}
    lane_meta: dict[str, dict] = {}
    scored_metrics: list[str] = []
    for m in metrics:
        if m in NEURAL_LANES:
            fn, meta = _attach_neural(m, entries, target_lang)
            if fn is None:
                notes[m] = meta
                continue
            fns[m] = fn
            lane_meta[m] = meta
        scored_metrics.append(m)
    if conventions:
        from .convention_lint import lint

        def mixed_fn(sub_entries: list[dict]) -> float:
            texts = [e["predicted_raw"] for e in sub_entries]
            return lint(texts, conventions).mixed_rate

        fns["mixed_convention_rate"] = mixed_fn
        scored_metrics.append("mixed_convention_rate")
    lanes = [PluginLane(p, entries) for p in plugins]

    report = BatteryReport(eval_set=eval_set, by=by, n=len(entries),
                           config_hash=config_hash, notes=notes,
                           near_dupe=near_dupe_meta,
                           prereg_id=(prereg_doc or {}).get("id"),
                           prereg_bound_by=(prereg_doc or {}).get("bound_by"),
                           prereg_after_reads=preregister.after_reads_info(
                               workspace, (prereg_doc or {}).get("id")),
                           dataset_id=ident["dataset_id"],
                           dataset_id_source=ident["dataset_id_source"])
    group_names = sorted({e["_group"] for e in entries})

    def _score_sub(sub: list[dict], label: str) -> ScoreReport:
        out: dict[str, dict] = {}
        for m in scored_metrics:
            ci = conf.bootstrap_ci(sub, fns[m], n_bootstrap=n_bootstrap,
                                   alpha=alpha, seed=seed, metric_name=m)
            out[m] = {"score": ci.score, "ci_lower": ci.ci_lower,
                      "ci_upper": ci.ci_upper, "n_bootstrap": ci.n_bootstrap,
                      "seed": seed, **lane_meta.get(m, {})}
        plugin_aggregates = {}
        for lane in lanes:
            if lane.available:
                plugin_aggregates[lane.name] = lane.aggregate_for(sub)
            else:
                plugin_aggregates[lane.name] = lane.aggregate
        return ScoreReport(n=len(sub), scores=out, eval_set=label,
                           plugin_aggregates=plugin_aggregates)

    for g in group_names:
        sub = [e for e in entries if e["_group"] == g]
        report.groups[g] = _score_sub(sub, f"{eval_set}:{g}")
        if near_dupe_corpus is not None:
            strict = [e for e in sub if not e["_near_dupe"]]
            if len(strict) < len(sub):
                if strict:
                    report.strict_groups[g] = _score_sub(
                        strict, f"{eval_set}:{g}:strict")
                else:
                    # every row in the group has a train near-twin — there is
                    # no clean subset to score; say so rather than render n=0
                    report.notes[f"{g} (strict)"] = (
                        "all rows have a train-side near-twin; no clean "
                        "subset exists for this group")
    if near_dupe_corpus is not None:
        clean = [e for e in entries if not e["_near_dupe"]]
        if 0 < len(clean) < len(entries):
            report.strict_overall = _score_sub(clean, f"{eval_set}:strict")
    n_total = len(entries)
    for m in scored_metrics:
        report.weighted[m] = sum(
            report.groups[g].scores[m]["score"] * report.groups[g].n
            for g in group_names) / n_total
    report.weighted["note"] = ("weighted mean across groups — headline "
                               "claims stay per-group")

    workspace.ledger.append(
        "score", set=eval_set, config_hash=config_hash, kind="battery",
        by=by, groups={g: report.groups[g].n for g in group_names},
        metrics={m: round(report.weighted[m], 4) for m in scored_metrics},
        n=n_total,
        **({"near_dupe_flagged": near_dupe_meta["flagged"]}
           if near_dupe_meta else {}),
    )
    if entry_meta["role"] == "sealed":
        workspace.ledger.append("sealed-spend", set=eval_set,
                                config_hash=config_hash)
    if keep_entries:
        report.entries = [
            {"id": e["id"], "source": e["source"],
             "expected": e["expected_raw"], "predicted": e["predicted_raw"],
             "segment": e["_group"]}
            for e in entries
        ]
    return report


def compare_on_eval_set(
    workspace: Workspace,
    eval_set: str,
    hyps_a: list[str],
    hyps_b: list[str],
    *,
    labels: tuple[str, str] = ("A", "B"),
    config_hash: str | None = None,
    metrics: tuple[str, ...] = ("chrf++",),
    plugins: tuple = (),
    target_lang: str = "",
    n_trials: int = 1000,
    n_bootstrap_ci: int = 1000,
    seed: int = 12345,
    override_respend: str | None = None,
    prereg_id: str | None = None,
) -> CompareReport:
    """The comparison table for a registered set — refuses without a prereg.

    This is the ledger's requirement verbatim: the runner refuses to print a
    comparison table unless a preregistration exists (for test/sealed roles).
    """
    entry = workspace.registry.get(eval_set)
    ident = _identity(workspace, eval_set)
    prereg_doc = None
    if entry["role"] in ("test", "sealed"):
        prereg_doc = preregister.require_prereg(
            workspace, eval_set, config_hash, prereg_id=prereg_id)
    rows = workspace.registry.open_eval(
        eval_set, "score", config_hash=config_hash,
        override_respend=override_respend,
        prereg_id=(prereg_doc or {}).get("id"),
    )
    refs = [str(r[entry["target_field"]]) for r in rows]
    sources = [str(r.get(entry["source_field"], "")) for r in rows]
    for name, hyps in ((labels[0], hyps_a), (labels[1], hyps_b)):
        if len(hyps) != len(refs):
            raise ScoringError(
                f"system {name!r}: {len(hyps)} hypotheses for {len(refs)} rows"
            )
    report = compare(
        hyps_a, hyps_b, refs, sources, labels=labels, metrics=metrics,
        plugins=plugins, target_lang=target_lang, n_trials=n_trials,
        n_bootstrap_ci=n_bootstrap_ci, seed=seed,
    )
    report.eval_set = eval_set
    report.dataset_id = ident["dataset_id"]
    report.dataset_id_source = ident["dataset_id_source"]
    workspace.ledger.append(
        "score", set=eval_set, config_hash=config_hash, kind="compare",
        systems=list(labels),
        metrics={m: round(r["delta"], 4) for m, r in report.results.items()},
        n=report.n,
    )
    if entry["role"] == "sealed":
        workspace.ledger.append("sealed-spend", set=eval_set, config_hash=config_hash)
    return report
