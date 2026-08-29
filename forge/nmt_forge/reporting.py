"""Plain-language run reports — what trained, what the guards did, what the
numbers mean (founder acceptance criterion 4: nobody should reconstruct a
run from raw logs and JSON).

Renderers take the MANIFESTS forge already writes (run-manifest.json /
battery manifests) and produce a markdown narrative. They add no new facts —
every sentence traces to a manifest field — so the report can be regenerated
at any time with ``nmt-forge report <manifest.json>``.
"""

from __future__ import annotations

import json
from pathlib import Path


def _fmt_ci(s: dict) -> str:
    return f"{s['score']:.2f} [{s['ci_lower']:.2f}, {s['ci_upper']:.2f}]"


def render_run_report(manifest: dict) -> str:
    lines = [f"# Run report — {manifest['run_name']}", ""]
    lines += [
        f"*Config hash `{manifest['config_hash']}` · backend "
        f"`{manifest['backend']}` · git `{manifest.get('git_commit', '?')[:12]}`*",
        "",
        "## What trained",
        "",
    ]
    lang = (manifest.get("config") or {}).get("language") or {}
    if lang:
        lines.append(f"- language pair: **{lang.get('source', '?')} → "
                     f"{lang.get('target', '?')}**"
                     + (f" ({lang.get('target_name')})"
                        if lang.get("target_name") else ""))
    dev = manifest.get("dev_set", {})
    lines.append(f"- dev set: **{dev.get('name')}** ({dev.get('rows')} rows, "
                 f"sha `{str(dev.get('sha256', ''))[:12]}…`) — the ONLY data "
                 "checkpoint selection ever saw (dev-fence)")
    for stage in manifest.get("stages", []):
        mix = stage.get("mix", {})
        gold = mix.get("gold", {})
        lines += [
            "",
            f"### Stage `{stage.get('stage')}`",
            "",
            f"- mix: {mix.get('total_rows', '?'):,} rows — "
            f"{gold.get('rows', 0):,} gold × upweight {gold.get('upweight')} "
            f"(effective exposure per unique sentence: "
            f"{gold.get('effective_exposure_per_unique_sentence')}) + "
            f"{sum(l.get('rows', 0) for l in mix.get('synthetic', [])):,} "
            "synthetic (tagged — the model can tell them from real text; "
            "inference is untagged)",
        ]
        for lane in mix.get("synthetic", []):
            rights = lane.get("rights")
            lines.append(f"  - lane `{lane.get('origin') or lane.get('path')}` "
                         f"tag `{lane.get('tag')}`: {lane.get('rows'):,} rows"
                         + (f" — rights: {rights}" if rights else ""))
        sched = stage.get("schedule", {})
        if sched:
            lines += [
                "",
                "**What the schedule guard did:** regime "
                f"`{sched.get('regime')}` ({sched.get('regime_source')}), "
                f"early-stop floor {sched.get('floor_steps', 0):,} of "
                f"{sched.get('planned_steps', 0):,} planned steps.",
                "",
                f"> {sched.get('reason', '')}",
            ]
            for note in sched.get("notes", []):
                lines.append(f"> NOTE: {note}")
        if stage.get("stop_explanation"):
            lines += ["", f"**Early stopping:** {stage['stop_explanation']}"]
        sel = stage.get("selection", {})
        if sel:
            lines += [
                "",
                f"**Checkpoint selection:** `{sel.get('selected')}` won on "
                f"`{sel.get('metric')}` over {len(sel.get('per_checkpoint', []))} "
                "candidate(s) — selected by the DEV set, never the test set.",
            ]
    dev_report = manifest.get("dev_report", {})
    if dev_report:
        lines += ["", "## Dev results (95% bootstrap CIs — never bare numbers)", ""]
        for m, s in (dev_report.get("scores") or {}).items():
            suffix = " *(lower = better)*" if s.get("direction") == "lower" else ""
            lines.append(f"- **{m}**: {_fmt_ci(s)}{suffix}")
        for lane, reason in (dev_report.get("notes") or {}).items():
            lines.append(f"- {lane}: unavailable — {reason}")
        lines += [
            "",
            "*Reading these:* the bracket is where the true corpus score "
            "plausibly lives; overlapping brackets between two runs mean the "
            "difference may be noise (use `nmt-forge compare` for a paired "
            "significance test). Dev numbers guide ITERATION — test-set "
            "claims require a preregistration first (`nmt-forge prereg new`).",
        ]
    lines += [
        "",
        "## Provenance",
        "",
        f"- manifest: `{manifest.get('manifest_path', 'run-manifest.json')}`",
        "- every read of a registered eval set is in the workspace ledger "
        "(`nmt-forge ledger show --set <name>`)",
    ]
    return "\n".join(lines) + "\n"


def render_battery_report(manifest: dict) -> str:
    # (diagnosis section appended at the end — see battery_lint)
    lines = [
        f"# Battery report — {manifest['eval_set']}",
        "",
        f"*{manifest['n']} rows, grouped by `{manifest['by']}` · config "
        f"`{manifest.get('config_hash') or '—'}`*",
        "",
        "Every score carries its 95% bootstrap CI. Group sizes differ — "
        "small groups have wide brackets, and that width IS the honest "
        "claim. The weighted ALL row is a summary, never a headline.",
        "",
    ]
    groups = manifest.get("groups", {})
    metric_names: list[str] = []
    for rep in groups.values():
        for m in rep.get("scores", {}):
            if m not in metric_names:
                metric_names.append(m)
    header = "| group | n | " + " | ".join(metric_names) + " |"
    lines += [header,
              "|" + "---|" * (2 + len(metric_names))]
    for g in sorted(groups):
        rep = groups[g]
        cells = []
        for m in metric_names:
            s = rep.get("scores", {}).get(m)
            cells.append(_fmt_ci(s) if s else "—")
        lines.append(f"| {g} | {rep.get('n')} | " + " | ".join(cells) + " |")
        strict = manifest.get("strict_groups", {}).get(g)
        if strict:
            cells = []
            for m in metric_names:
                s = strict.get("scores", {}).get(m)
                cells.append(_fmt_ci(s) if s else "—")
            lines.append(f"| {g} (strict) | {strict.get('n')} | "
                         + " | ".join(cells) + " |")
    weighted = manifest.get("weighted", {})
    if weighted:
        cells = []
        for m in metric_names:
            v = weighted.get(m)
            cells.append(f"{v:.2f}" if isinstance(v, (int, float)) else "—")
        lines.append(f"| **ALL (weighted)** | {manifest['n']} | "
                     + " | ".join(cells) + " |")
    # plugin lanes (referee verdicts) per group, compactly
    plugin_lines = []
    for g in sorted(groups):
        aggs = groups[g].get("plugin_aggregates") or {}
        for name, agg in aggs.items():
            numeric = {k: v for k, v in agg.items()
                       if isinstance(v, (int, float)) and not isinstance(v, bool)}
            if numeric:
                cells = ", ".join(f"{k}={v:.3g}" for k, v in numeric.items())
                plugin_lines.append(f"- `{g}` · {name}: {cells}")
    if plugin_lines:
        lines += ["", "## Referee lanes (per group)", ""] + plugin_lines
    nd = manifest.get("near_dupe") or {}
    if nd:
        lines += ["", f"Near-dupe lane: {nd.get('flagged')} of "
                  f"{manifest['n']} rows have a train-side near-twin "
                  f"(Jaccard ≥ {nd.get('params', {}).get('jaccard_threshold')})"
                  ". \"(strict)\" rows exclude them — the full-vs-strict gap "
                  "is the optimism bound from reworded training siblings."]
    for lane, reason in (manifest.get("notes") or {}).items():
        lines += ["", f"- {lane}: UNAVAILABLE — {reason}"]
    try:
        from .guards.battery_lint import lint_battery, render_diagnosis

        findings = lint_battery(manifest)
        lines += ["", render_diagnosis(findings)]
    except Exception as exc:  # diagnosis must never break the report
        lines += ["", f"(battery-lint unavailable: {exc})"]
    return "\n".join(lines) + "\n"


def render(manifest_path: str | Path) -> str:
    """Dispatch on manifest shape; used by ``nmt-forge report``."""
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    if manifest.get("guard") == "ci-scoring/battery":
        return render_battery_report(manifest)
    if "run_name" in manifest and "stages" in manifest:
        return render_run_report(manifest)
    raise ValueError(
        f"{manifest_path}: not a run manifest or battery manifest"
    )
