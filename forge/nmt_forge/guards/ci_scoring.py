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

from .. import _harness
from ..errors import ScoringError
from ..plugins import PluginLane
from ..workspace import Workspace
from . import preregister

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
              "fix": "pip install 'mt-eval[comet]' (unbabel-comet + torch)"},
    "comet-qe": {"cache_key": "qe_score", "direction": "higher",
                 "loader": _qe_loader,
                 "fix": "pip install 'mt-eval[comet]' (unbabel-comet + torch)"},
    "metricx": {"cache_key": "metricx_score", "direction": "lower",
                "loader": _metricx_loader,
                "fix": "pip install 'mt-eval[metricx]' + the google-research/"
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

    def format(self) -> str:
        """Render scores — ALWAYS with their CIs. There is no bare-score path."""
        lines = [f"n={self.n}" + (f" · set={self.eval_set}" if self.eval_set else "")]
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
        }


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
            fix="for LYSS lanes pass plugins=(...) (lanes are named "
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
) -> ScoreReport:
    """The audited scoring path for a registered eval set.

    Order matters and is enforced: for test/sealed sets the preregistration
    gate runs BEFORE the set is read, so a refusal leaves no score-purpose
    read in the ledger.
    """
    entry = workspace.registry.get(eval_set)
    if entry["role"] in ("test", "sealed"):
        preregister.require_prereg(workspace, eval_set, config_hash)
    rows = workspace.registry.open_eval(
        eval_set, "score", config_hash=config_hash,
        override_respend=override_respend,
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

    def format(self) -> str:
        a, b = self.labels
        lines = [f"paired approximate randomization · n={self.n}"
                 + (f" · set={self.eval_set}" if self.eval_set else "")]
        for m, r in self.results.items():
            verdict = (f"significant, winner={r['winner']}"
                       if r["significant"] else "not significant")
            lines.append(
                f"  {m:<12} {a}={r['score_a']:.2f} {b}={r['score_b']:.2f} "
                f"Δ={r['delta']:+.2f} [{r['ci_lower']:+.2f}, {r['ci_upper']:+.2f}] "
                f"p={r['p_value']:.4f} → {verdict}"
            )
        return "\n".join(lines)


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

    def format(self) -> str:
        lines = [f"battery: {self.eval_set} · grouped by {self.by!r} · "
                 f"n={self.n}"]
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
        if self.near_dupe:
            flagged = self.near_dupe.get("flagged", 0)
            lines.append(
                f"  near-dupe lane: {flagged}/{self.n} rows have a "
                f"train-side near-twin (Jaccard ≥ "
                f"{self.near_dupe['params']['jaccard_threshold']}); "
                "strict rows exclude them — the gap between full and strict "
                "is the optimism bound")
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
            "by": self.by,
            "n": self.n,
            "config_hash": self.config_hash,
            "groups": {g: r.to_manifest() for g, r in self.groups.items()},
            "strict_groups": {g: r.to_manifest()
                              for g, r in self.strict_groups.items()},
            "near_dupe": {k: v for k, v in self.near_dupe.items()
                          if k != "indices"} if self.near_dupe else {},
            "weighted": self.weighted,
            "notes": self.notes,
        }


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
    near_dupe_jaccard: float = 0.6,
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
    if entry_meta["role"] in ("test", "sealed"):
        preregister.require_prereg(workspace, eval_set, config_hash)
    rows = workspace.registry.open_eval(
        eval_set, "score", config_hash=config_hash,
        override_respend=override_respend,
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
            "_group": str(row.get(by, "?")),
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
                           near_dupe=near_dupe_meta)
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
) -> CompareReport:
    """The comparison table for a registered set — refuses without a prereg.

    This is the ledger's requirement verbatim: the runner refuses to print a
    comparison table unless a preregistration exists (for test/sealed roles).
    """
    entry = workspace.registry.get(eval_set)
    if entry["role"] in ("test", "sealed"):
        preregister.require_prereg(workspace, eval_set, config_hash)
    rows = workspace.registry.open_eval(
        eval_set, "score", config_hash=config_hash,
        override_respend=override_respend,
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
    workspace.ledger.append(
        "score", set=eval_set, config_hash=config_hash, kind="compare",
        systems=list(labels),
        metrics={m: round(r["delta"], 4) for m, r in report.results.items()},
        n=report.n,
    )
    if entry["role"] == "sealed":
        workspace.ledger.append("sealed-spend", set=eval_set, config_hash=config_hash)
    return report
