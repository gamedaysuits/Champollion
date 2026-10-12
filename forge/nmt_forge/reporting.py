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


def render_run_report(manifest: dict, exports: list[dict] | None = None,
                      ) -> str:
    """The run's plain-language report. ``exports``: what each export of
    this run measured on its test set (:func:`run_exports`) — the test
    score with its CI, the near-twin caveat, the twin-free sibling to quote
    and the prereg verdicts (computed and human, apart). None = not looked
    up (the report `nmt-forge run` writes at training time, before any
    export exists)."""
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
    dev_id = dev.get("dataset_id")
    lines.append(f"- dev set: **{dev.get('name')}**"
                 + (f" (dataset `{dev_id}`)"
                    if dev_id and dev_id != dev.get("name") else "")
                 + f" ({dev.get('rows')} rows, "
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
        from .scoring_standard import label

        for m, s in (dev_report.get("scores") or {}).items():
            suffix = " *(lower = better)*" if s.get("direction") == "lower" else ""
            lines.append(f"- **{label(m)}**: {_fmt_ci(s)}{suffix}")
        for lane, reason in (dev_report.get("notes") or {}).items():
            lines.append(f"- {lane}: unavailable — {reason}")
        from .guards.ci_scoring import run_dev_saturation

        sat = run_dev_saturation(manifest)
        if sat:
            msg = sat["message"].strip().rstrip(".")
            lines += ["", f"**⚠ {msg[:1].upper()}{msg[1:]}.** Saturation "
                          f"bound: {sat['bound']}.", "",
                      f"*What to do:* {sat['advice']}."]
        lines += [
            "",
            "*Reading these:* the bracket is where the true corpus score "
            "plausibly lives; overlapping brackets between two runs mean the "
            "difference may be noise (use `nmt-forge compare` for a paired "
            "significance test). Dev numbers guide ITERATION — test-set "
            "claims require a preregistration first (`nmt-forge prereg new`).",
        ]
    if exports is not None:
        lines += _export_section(exports)
    lines += [
        "",
        "## Provenance",
        "",
        f"- manifest: `{manifest.get('manifest_path', 'run-manifest.json')}`",
        "- every read of a registered eval set is in the workspace ledger "
        "(`nmt-forge ledger show --set <name>`)",
    ]
    return "\n".join(lines) + "\n"


def render_battery_report(manifest: dict, manifest_path=None) -> str:
    """The battery report. ``manifest_path`` (when known) finds the mt-eval
    TestReport of the same read for a manifest written before it recorded
    the harness's caveats (``harness_caveats.for_battery_manifest``)."""
    # (diagnosis section appended at the end — see battery_lint)
    from .harness_caveats import for_battery_manifest, markdown_lines

    caveats = for_battery_manifest(manifest, manifest_path)
    did = manifest.get("dataset_id")
    named = (f"# Battery report — {did} (forge set `{manifest['eval_set']}`)"
             if did and did != manifest["eval_set"]
             else f"# Battery report — {manifest['eval_set']}")
    lines = [
        named,
        "",
        f"*{manifest['n']} rows, grouped by `{manifest['by']}` · config "
        f"`{manifest.get('config_hash') or '—'}`*"
        + (f" · dataset id from {manifest['dataset_id_source']}"
           if did and did != manifest["eval_set"]
           and manifest.get("dataset_id_source") else ""),
        "",
        "Every score carries its 95% bootstrap CI. Group sizes differ — "
        "small groups have wide brackets, and that width IS the honest "
        "claim. The weighted ALL row is a summary, never a headline.",
        "",
    ]
    from .scoring_standard import (HEADLINE_NOTE, for_battery_manifest,
                                   headline_text)

    # scoring standard/1: the read's ONE headline — the mt-eval TestReport's
    # corpus chrF++ with its 95% CI (a single-group battery's chrF++ when
    # there is no TestReport); exact match and plugin lanes are diagnostics
    hl = for_battery_manifest(manifest, manifest_path)
    if hl is not None:
        lines += [f"**Headline: {headline_text(hl)}** — {HEADLINE_NOTE}"
                  + (f"; sacreBLEU signature `{hl['signature']}`"
                     if hl.get("signature") else "")
                  + ". Every other column is shown beside it, never blended"
                    " into it; exact match and referee lanes are "
                    "diagnostics.", ""]
    if manifest.get("prereg"):
        # which predictions this run is judged against — named, so two runs
        # on one test set can never quietly share a verdict
        lines += [f"Judged against preregistration `{manifest['prereg']}`"
                  + (f" ({manifest['prereg_bound_by']})"
                     if manifest.get("prereg_bound_by") else "")
                  + f" — `nmt-forge prereg check {manifest['prereg']}`.", ""]
        after = manifest.get("prereg_after_reads")
        if after:
            t = after["text"]
            lines += [f"**Not blind:** {t[:1].upper() + t[1:]}.", ""]
    groups = manifest.get("groups", {})
    metric_names: list[str] = []
    for rep in groups.values():
        for m in rep.get("scores", {}):
            if m not in metric_names:
                metric_names.append(m)
    from .scoring_standard import BATTERY_PRIMARY, label

    # chrF++ (the standard's headline metric) is the first column
    metric_names.sort(key=lambda m: m != BATTERY_PRIMARY)
    header = ("| group | n | " + " | ".join(label(m) for m in metric_names)
              + " |")
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
    strict_all = manifest.get("strict_overall")
    if strict_all and len(groups) > 1:
        cells = []
        for m in metric_names:
            s = (strict_all.get("scores") or {}).get(m)
            cells.append(_fmt_ci(s) if s else "—")
        lines.append(f"| ALL (strict) | {strict_all.get('n')} | "
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
        from .guards.ci_scoring import near_twin_summary

        summary = near_twin_summary(manifest)
        if summary["recall_not_translation"]:
            lines += ["", f"**{summary['message'][0].upper()}"
                          f"{summary['message'][1:]}.**"]
    # what mt-eval says qualifies these scores, in its own words, right
    # under them (harness_caveats; Round 13)
    cav = markdown_lines(caveats)
    if cav:
        lines += ["", "**What qualifies these scores (mt-eval):**", ""]
        lines += [f"- {c}" for c in cav]
    for lane, reason in (manifest.get("notes") or {}).items():
        lines += ["", f"- {lane}: UNAVAILABLE — {reason}"]
    try:
        from .guards.battery_lint import lint_battery, render_diagnosis

        findings = lint_battery(manifest, harness_caveats=caveats,
                                headline=hl)
        lines += ["", render_diagnosis(findings)]
    except Exception as exc:  # diagnosis must never break the report
        lines += ["", f"(battery-lint unavailable: {exc})"]
    return "\n".join(lines) + "\n"


def _export_section(exports: list[dict]) -> list[str]:
    """The run report's test-set section, from what each export wrote."""
    lines = ["", "## Test results (from `nmt-forge export`)", ""]
    if not exports:
        return lines + [
            "Not exported yet — the test set has not been scored for this "
            "run. `nmt-forge export <this run's manifest> --out <dir>` "
            "scores it once (prereg-gated) and packages the model; this "
            "report then shows the result."]
    for x in exports:
        lines.append(f"### Export `{x['dir']}`"
                     + (f" — model `{x['name']}`" if x.get("name") else ""))
        lines.append("")
        if not x.get("readable"):
            lines.append(f"- {x.get('caveat') or 'forge-model.json unreadable'}")
            lines.append("")
            continue
        tr = x.get("test_report")
        if not tr:
            lines += ["- not scored on a test set (exported with "
                      "`--no-eval`)", ""]
            continue
        label = (f"`{tr.get('dataset_id')}` (forge set `{tr['set']}`)"
                 if tr.get("dataset_id") and tr.get("dataset_id") != tr["set"]
                 else f"`{tr['set']}`")
        lines.append(f"- test set {label}, n={tr.get('n')}")
        from .scoring_standard import (HEADLINE_NOTE, cite, headline_text,
                                       score_line)

        # scoring standard/1: the headline first — corpus chrF++ with its
        # 95% CI (and signature), the standard metrics beside it
        hl = x.get("headline")
        lines.append(f"- **headline: {headline_text(hl)}** — {HEADLINE_NOTE}"
                     + (f"; sacreBLEU signature `{hl['signature']}`"
                        if (hl or {}).get("signature") else ""))
        for g, scores in (tr.get("groups") or {}).items():
            if len(tr["groups"]) == 1:
                # the headline above already gives this read's chrF++
                rest = score_line(scores, primary=False)
                if rest:
                    lines.append(f"- also on this read: {rest}")
                continue
            lines.append(f"- {g}: " + score_line(scores))
        strict = tr.get("strict_overall") or {}
        if any(isinstance(v, dict) and "ci_lower" in v
               for v in strict.values()):
            lines.append("- twin-free strict subset (test rows with no "
                         "near-twin in training): " + score_line(strict))
        nt = tr.get("near_twin") or {}
        if nt.get("message"):
            msg = nt["message"][:1].upper() + nt["message"][1:]
            lines.append(f"- caveat: **{msg}**" if nt.get(
                "recall_not_translation") else f"- caveat: {msg}")
        from .harness_caveats import QUOTE_WITH_CAVEAT, majors, markdown_lines

        # what mt-eval says qualifies this score, in its words (Round 13)
        lines += [f"- {c}" for c in markdown_lines(x.get("score_caveats"))]
        for sib in x.get("twin_free_siblings") or []:
            flagged = bool(majors(sib.get("score_caveats")))
            lines.append(
                "- the number to quote for new sentences"
                + (f" — {QUOTE_WITH_CAVEAT}" if flagged else "")
                + f": twin-free model "
                f"`{sib['name']}` (run `{sib['run']}`) — "
                f"{cite(sib.get('score'))}"
                + " on the same test set (that model's score)")
            lines += [f"  - on that model's test output: {c}"
                      for c in markdown_lines(sib.get("score_caveats"))]
        pre = x.get("prereg")
        if pre:
            from .guards.preregister import counts_text, verdict_counts

            rows = pre.get("verdicts") or []
            lines.append(f"- preregistration `{pre['id']}`"
                         + (f" ({pre['bound_by']})" if pre.get("bound_by")
                            else "") + ": "
                         + counts_text(verdict_counts(rows)))
            if pre.get("after_reads"):
                t = pre["after_reads"]["text"]
                lines.append(f"  - **not blind:** {t[:1].upper() + t[1:]}")
            for r in rows:
                hv = r.get("human_verdict")
                if r.get("verdict") == "manual" and hv:
                    v = (f"{hv['verdict'].upper()} — human verdict by "
                         f"{hv['by']}, {hv['ts']} (recorded, not computed)"
                         + (f"; note: {hv['note']}" if hv.get("note") else ""))
                elif r.get("verdict") == "manual":
                    v = "for a human to judge (`nmt-forge prereg verdict`)"
                else:
                    v = f"{r['verdict'].upper()} (computed)"
                obs = r.get("observed")
                pred = (f"{r['predicted']} vs {r['baseline_score']}"
                        + (f" (margin {r['margin']})" if r.get("margin")
                           else "")
                        if r.get("baseline_score") is not None
                        and r.get("predicted") in ("increase", "decrease",
                                                   "no_change")
                        else f"\"{r['predicted']}\"")
                lines.append(f"  - #{r.get('number')} {r['metric']}: "
                             f"predicted {pred}; observed "
                             + (f"{obs:.2f}" if isinstance(obs, (int, float))
                                else "—") + f" → {v}")
        lines.append("")
    return lines


def _run_prereg_section(manifest: dict, ws) -> str:
    """Which preregistration this run is judged against on its test set
    (``preregister.run_binding``) — named even before the export, so two
    preregs on one test set never leave it open (Round 7)."""
    from .guards.preregister import run_binding

    battery = ((manifest.get("config") or {}).get("eval") or {}).get(
        "battery")
    if ws is None or not battery:
        return ""
    try:
        ws.registry.get(battery)
        b = run_binding(ws, battery, manifest.get("config_hash"))
    except Exception:
        return ""
    head = "## Preregistration"
    if b["state"] in ("judged", "would-bind"):
        from .guards.preregister import after_reads_info

        body = (f"This run is judged against `{b['id']}` on `{battery}` — "
                f"{b['how']}. `nmt-forge prereg check {b['id']}` shows the "
                "verdicts.")
        after = after_reads_info(ws, b["id"])
        if after:
            t = after["text"]
            body += f"\n\n**Not blind:** {t[:1].upper() + t[1:]}."
    elif b["state"] == "ambiguous":
        body = (f"**Not decided:** {b['how']}. Pin each prereg to its run "
                "(`nmt-forge prereg new … --config-hash "
                f"{manifest.get('config_hash')}`) or pass `--prereg <id>` to "
                "`nmt-forge export`.")
    else:
        body = f"None binds this run on `{battery}` yet: {b['how']}."
    return f"{head}\n\n{body}\n"


def run_exports(manifest_path: str | Path, workspace=None) -> list[dict]:
    """What every export of this run (the workspace ledger's ``export``
    events naming this manifest) measured on its test set, read from its
    forge-model.json, with a person's recorded prereg verdicts attached."""
    from .export import twin_free_siblings, workspace_exports
    from .guards import preregister

    if workspace is None:
        return []
    mp = Path(manifest_path).resolve()
    out = []
    for x in workspace_exports(workspace):
        doc = x["doc"]
        rm = (doc.get("run") or {}).get("manifest")
        if not rm or Path(rm).resolve() != mp:
            continue
        tr = doc.get("test_report")
        from .harness_caveats import for_export
        from .scoring_standard import for_export as headline_for_export

        item = {"dir": x["dir"], "name": doc.get("name"), "readable": True,
                "test_report": tr, "prereg": None,
                # the standard/1 headline: corpus chrF++ with its CI
                "headline": headline_for_export(x["fm"], doc),
                "twin_free_siblings": [],
                # mt-eval's caveats on this score, verbatim (Round 13)
                "score_caveats": for_export(x["fm"], doc)["score_caveats"]}
        if tr:
            pre = tr.get("prereg") or {}
            if pre.get("id"):
                rows = [{**r, "number": r.get("number") or i}
                        for i, r in enumerate(pre.get("verdicts") or [], 1)]
                item["prereg"] = {**pre, "verdicts": preregister.
                                  attach_human_verdicts(workspace, pre["id"],
                                                        rows),
                                  # exports before Round 9: read it live
                                  "after_reads": pre.get("after_reads")
                                  or preregister.after_reads_info(
                                      workspace, pre["id"])}
            if (tr.get("near_twin") or {}).get("recall_not_translation"):
                item["twin_free_siblings"] = twin_free_siblings(
                    workspace, tr.get("set"), exclude_dir=x["dir"])
        out.append(item)
    return out


def workspace_for_manifest(manifest_path: str | Path, fallback=None):
    """The workspace a run manifest lives in (``<ws>/runs/<run>/run-
    manifest.json``), else ``fallback`` (a path) when it is a workspace."""
    from .workspace import Workspace

    mp = Path(manifest_path).resolve()
    ws_root = mp.parent.parent.parent if mp.parent.parent.name == "runs" \
        else None
    if ws_root is not None and (ws_root / "ledger.jsonl").is_file():
        return Workspace(ws_root)
    if fallback is not None and (Path(fallback) / "ledger.jsonl").is_file():
        return Workspace(fallback)
    return None


def render(manifest_path: str | Path, workspace=None) -> str:
    """Dispatch on manifest shape; used by ``nmt-forge report``. A run
    manifest's report includes what its exports measured on the test set
    (``workspace``: a path, used when the manifest's own workspace cannot be
    found from where it sits)."""
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    if manifest.get("guard") == "ci-scoring/battery":
        return render_battery_report(manifest, manifest_path)
    if "run_name" in manifest and "stages" in manifest:
        ws = workspace_for_manifest(manifest_path, workspace)
        text = render_run_report(
            manifest, exports=(run_exports(manifest_path, ws)
                               if ws is not None else None))
        binding = _run_prereg_section(manifest, ws)
        return text.rstrip("\n") + "\n\n" + binding if binding else text
    raise ValueError(
        f"{manifest_path}: not a run manifest or battery manifest"
    )
