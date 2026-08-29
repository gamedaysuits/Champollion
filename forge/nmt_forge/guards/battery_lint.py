"""battery-lint — turn a battery table into a diagnosis and a next lever.

A novice's agent sees a table of numbers and CI brackets. This rule engine
reads the battery manifest (guard: "ci-scoring/battery") plus optional
coverage-map / run manifests and emits FINDINGS: which registers are weak,
the likeliest cause given the co-occurring signals, and the exact lever to
pull next. Every rule carries an id, the evidence it fired on, and a cited
rationale — recommendations are explainable or they are noise.

Levers (the vocabulary of recommendations, from the crk reference work):
  VOCABULARY   the model lacks the words (dictionary/attestation growth)
  STRUCTURE    the model lacks the sentence shapes (templates/compositor)
  ORTHOGRAPHY  convention mixing (canonicalize training, not the model)
  REAL-DATA    synthetic→real transfer plateau (BT/monolingual/parallel)
  MEASUREMENT  the number can't carry the claim (n, CIs, optimism bound)
  REFEREE      a metric lane is unavailable (install/configure it)

Thresholds are deliberately conservative defaults, overridable per call —
they encode the crk reference measurements, not universal constants.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Finding:
    rule: str
    lever: str
    group: str | None
    severity: str          # "high" | "medium" | "info"
    evidence: dict
    recommendation: str

    def to_json(self) -> dict:
        return {"rule": self.rule, "lever": self.lever, "group": self.group,
                "severity": self.severity, "evidence": self.evidence,
                "recommendation": self.recommendation}


@dataclass
class LintConfig:
    coverage_low: float = 0.15        # gloss/lemma coverage below = vocab gap
    coverage_ok: float = 0.30
    incomplete_high: float = 0.60
    mixed_convention_min: float = 0.01
    optimism_gap: float = 3.0         # full-vs-strict primary-metric gap
    ci_width_wide: float = 8.0        # primary-metric CI width = low power
    primary_metric: str = "chrf++"
    # plugin-lane names (crk pack conventions; other packs may remap). These
    # are emitted by referee plugins under group `plugin_aggregates`, not as
    # top-level `scores` — `_score` looks in both.
    coverage_lane: str = "gloss_coverage"
    incomplete_lane: str = "incomplete_at_0_5"
    mixed_lane: str = "mixed_convention_rate"


def _score(group_manifest: dict, metric: str):
    """Read a lane by name from a group manifest.

    Looks in top-level ``scores`` first (chrf++/bleu/mixed_convention_rate live
    there), then falls back to any ``plugin_aggregates`` referee lane with a
    matching leaf key (crk coverage/incomplete/FST-validity live there). This
    two-place lookup is why the vocabulary/structure/orthography rules fire on
    a real forge-produced battery, not only on a hand-shaped manifest.
    """
    s = (group_manifest.get("scores") or {}).get(metric)
    if isinstance(s, dict):
        return s.get("score"), s.get("ci_lower"), s.get("ci_upper")
    if isinstance(s, (int, float)):
        return s, None, None
    # fall back to referee plugin aggregates (flat leaf-key match)
    for agg in (group_manifest.get("plugin_aggregates") or {}).values():
        if isinstance(agg, dict) and metric in agg:
            v = agg[metric]
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                return v, None, None
    return None, None, None


def _stop_explanations(run_manifest: dict) -> list[str]:
    out = []
    top = run_manifest.get("stop_explanation")
    if top:
        out.append(str(top))
    for stage in run_manifest.get("stages") or []:
        se = stage.get("stop_explanation")
        if se:
            out.append(str(se))
    return out


def _dev_loss_trajectory(run_manifest: dict) -> list[tuple[int, float]]:
    """(step, dev_loss) pairs, sorted by step, gathered across all stages.

    Reads stages[].checkpoints[] (id/step/dev_loss) first, then falls back to
    a top-level ``checkpoints`` or ``history`` list for hand-shaped manifests.
    """
    pts: list[tuple[int, float]] = []
    sources = []
    for stage in run_manifest.get("stages") or []:
        sources.append(stage.get("checkpoints") or [])
    if not sources:
        sources.append(run_manifest.get("checkpoints")
                       or run_manifest.get("history") or [])
    for ckpts in sources:
        for c in ckpts:
            step, loss = c.get("step"), c.get("dev_loss")
            if isinstance(step, (int, float)) and isinstance(loss, (int, float)):
                pts.append((int(step), float(loss)))
    pts.sort()
    return pts


def _detect_plateau(traj: list[tuple[int, float]], *, rel_rise: float = 0.05,
                    min_points: int = 4) -> tuple[bool, dict]:
    """A transfer plateau: real-dev loss bottoms before the end and the tail
    rises meaningfully above that minimum (not a single noisy uptick)."""
    if len(traj) < min_points:
        return False, {}
    losses = [l for _, l in traj]
    i_min = min(range(len(losses)), key=lambda i: losses[i])
    if i_min >= len(losses) - 1:            # minimum is the last point → still improving
        return False, {}
    lo = losses[i_min]
    tail = losses[i_min + 1:]
    if lo <= 0:
        return False, {}
    rose = (max(tail) - lo) / lo
    # require the LAST point to also sit above the minimum (sustained, not a dip)
    if rose >= rel_rise and losses[-1] > lo:
        return True, {
            "min_at": f"step {traj[i_min][0]:,}",
            "min_dev_loss": round(lo, 3),
            "final_dev_loss": round(losses[-1], 3),
            "tail_rise_frac": round(rose, 3),
            "n_checkpoints": len(traj),
        }
    return False, {}


def lint_battery(manifest: dict, *, run_manifest: dict | None = None,
                 config: LintConfig | None = None) -> list[Finding]:
    cfg = config or LintConfig()
    findings: list[Finding] = []
    groups: dict = manifest.get("groups") or {}
    strict: dict = manifest.get("strict_groups") or {}

    ranked = []
    for g, gm in groups.items():
        score, lo, hi = _score(gm, cfg.primary_metric)
        cov, _, _ = _score(gm, cfg.coverage_lane)
        inc, _, _ = _score(gm, cfg.incomplete_lane)
        mixed, _, _ = _score(gm, cfg.mixed_lane)
        n = gm.get("n")
        if score is not None:
            ranked.append((score, g))

        # R1 vocabulary gap: can't say the words AND doesn't finish
        if (cov is not None and inc is not None
                and cov < cfg.coverage_low and inc > cfg.incomplete_high):
            findings.append(Finding(
                "R1-vocabulary-gap", "VOCABULARY", g, "high",
                {"coverage": cov, "incomplete": inc},
                f"{g}: coverage {cov:.2f} with incomplete {inc:.2f} — the "
                "model lacks this register's words. Grow the lexicon "
                "(dictionary/attestation harvest), then check funnel-audit "
                "for how many dictionary entries actually reach the corpus."))
        # R2 structure gap: has words, still doesn't finish
        elif (cov is not None and inc is not None
                and cov >= cfg.coverage_ok and inc > cfg.incomplete_high):
            findings.append(Finding(
                "R2-structure-gap", "STRUCTURE", g, "high",
                {"coverage": cov, "incomplete": inc},
                f"{g}: coverage {cov:.2f} but incomplete {inc:.2f} — the "
                "words are known, the sentence SHAPES aren't. Run "
                "coverage-map against your grammar checklist and add the "
                "missing constructions (compositor/templates)."))

        # R3 orthography mixing
        if mixed is not None and mixed > cfg.mixed_convention_min:
            findings.append(Finding(
                "R3-mixed-convention", "ORTHOGRAPHY", g, "medium",
                {"mixed_convention": mixed},
                f"{g}: {mixed:.1%} of outputs mix orthographic conventions — "
                "the training corpus taught conventions as interchangeable. "
                "convention-lint the corpus and retrain on ONE canonical "
                "convention (normalize at the boundaries instead)."))

        # R5 low power
        if (score is not None and lo is not None and hi is not None
                and (hi - lo) > cfg.ci_width_wide):
            findings.append(Finding(
                "R5-low-power", "MEASUREMENT", g, "info",
                {"n": n, "ci_width": round(hi - lo, 2)},
                f"{g}: {cfg.primary_metric} CI is ±{(hi - lo) / 2:.1f} wide "
                f"(n={n}) — deltas smaller than the CI are noise; don't act "
                "on them, grow the eval set for this register instead."))

        # R4 optimism bound (needs the strict twin)
        if g in strict:
            s_full, _, _ = _score(gm, cfg.primary_metric)
            s_strict, _, _ = _score(strict[g], cfg.primary_metric)
            if (s_full is not None and s_strict is not None
                    and (s_full - s_strict) > cfg.optimism_gap):
                findings.append(Finding(
                    "R4-optimism-bound", "MEASUREMENT", g, "medium",
                    {"full": s_full, "strict": s_strict,
                     "gap": round(s_full - s_strict, 2)},
                    f"{g}: full score {s_full:.1f} vs strict (no train-side "
                    f"near-twins) {s_strict:.1f} — the {s_full - s_strict:.1f}"
                    " gap is optimism from drill siblings. Cite the strict "
                    "number for generalization claims; carve near-dupe-aware "
                    "at the next re-split."))

    # R6 referee gaps
    for lane, reason in (manifest.get("notes") or {}).items():
        findings.append(Finding(
            "R6-referee-unavailable", "REFEREE", None, "info",
            {"lane": lane, "reason": str(reason)[:200]},
            f"metric lane {lane!r} is unavailable ({reason}) — scores are "
            "honest but blind on this axis; install/configure the referee."))

    # R7 transfer plateau — read from the run manifest's dev-loss trajectory,
    # which `run` writes per-STAGE under stages[].checkpoints (not top-level).
    # The signature is not a keyword: real-dev loss bottoms EARLY and then
    # rises while training continues (the model fits the synthetic mass). We
    # detect it directly: argmin dev-loss is not the last checkpoint AND the
    # tail rose meaningfully above that minimum.
    if run_manifest:
        traj = _dev_loss_trajectory(run_manifest)
        plateau, evidence = _detect_plateau(traj)
        # still honor an explicit plateau call in any stop explanation
        stops = " ".join(_stop_explanations(run_manifest)).lower()
        if plateau or "plateau" in stops:
            evidence = {**evidence, "stop": stops[:200]} if stops else evidence
            findings.append(Finding(
                "R7-transfer-plateau", "REAL-DATA", None, "high",
                evidence,
                "training mastered the synthetic mix while real-dev loss "
                f"bottomed early ({evidence.get('min_at', 'step ?')}) and rose "
                "after — more synthetic volume will not help. The levers that "
                "move this are real text: backtranslate monolingual "
                "target-language data, or acquire real parallel sentences."))

    # R8 weakest registers summary
    if len(ranked) >= 2:
        ranked.sort()
        weakest = [g for _, g in ranked[:2]]
        related = {f.group: f.rule for f in findings
                   if f.group in weakest and f.severity == "high"}
        findings.append(Finding(
            "R8-weakest-registers", "MEASUREMENT", None, "info",
            {"weakest": weakest,
             "diagnosed": related},
            f"weakest registers: {', '.join(weakest)}"
            + (f" — diagnosed causes: {related}" if related else
               " — no high-severity signal co-fired; inspect outputs "
               "manually before picking a lever.")))
    return findings


def render_diagnosis(findings: list[Finding]) -> str:
    if not findings:
        return ("Diagnosis: no lint findings — either the battery is healthy "
                "or its plugin lanes (coverage/incomplete/convention) are "
                "missing, which itself is worth checking.")
    order = {"high": 0, "medium": 1, "info": 2}
    lines = ["Diagnosis & Recommendations (battery-lint):", ""]
    for f in sorted(findings, key=lambda x: (order[x.severity], x.rule)):
        head = f"[{f.severity}] {f.rule}" + (f" · {f.group}" if f.group else "")
        lines.append(f"  {head}")
        lines.append(f"      {f.recommendation}")
    lines.append("")
    lines.append("  (rules are conservative defaults encoding the crk "
                 "reference measurements; evidence in --json output)")
    return "\n".join(lines)
