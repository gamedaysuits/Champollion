"""
Run Comparator — Compare multiple TestReport files side by side.

Generates a structured comparison showing how different configs
perform on the same corpus entries. Useful for answering:
    - "Did tool-calling improve accuracy?"
    - "How does Gemini compare to Claude on difficulty 5?"
    - "What's the cost/accuracy tradeoff between models?"

Also identifies per-entry regressions and improvements between runs.
"""

from __future__ import annotations

import json
from pathlib import Path
from dataclasses import asdict

from mt_eval_harness.significance import (
    run_significance_tests,
    format_significance_table,
    SignificanceResult,
)


def compare_reports(
    report_paths: list[str | Path],
    significance: bool = False,
    n_bootstrap: int = 1000,
) -> dict:
    """Load and compare multiple TestReport files.

    Args:
        report_paths: Paths to TestReport JSON files (from tester.py).
        significance: If True, run paired significance tests (approximate
            randomization by default; see significance.run_significance_tests).
        n_bootstrap: Number of resampling iterations for significance testing.

    Returns:
        Comparison dict with overall metrics, per-entry diffs, etc.
    """
    reports = []
    for p in report_paths:
        path = Path(p)
        if not path.exists():
            print(f"  WARNING: Report not found: {path}")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        reports.append(data)

    if len(reports) < 2:
        print("  Need at least 2 reports to compare")
        return {"error": "Insufficient reports"}

    # --- Overall comparison table ---
    comparison_rows = []
    for r in reports:
        config = r.get("config", {})
        overall = r.get("overall", {})
        row = {
            "run_id": r.get("run_id", "?"),
            "model": config.get("model", "?"),
            "prompt": config.get("prompt_version", "?"),
            "tools": config.get("tools_enabled", False),
            "batch_size": config.get("batch_size", 1),
            "entries": overall.get("evaluated", 0),
            "exact_match": overall.get("exact_match_rate", 0),
            "corpus_chrf": overall.get("corpus_chrf", 0),
            "comet_score": overall.get("comet_score"),
            "comet_model": overall.get("comet_model", ""),
            "total_cost": overall.get("total_cost_usd", 0),
            "avg_latency": overall.get("avg_latency_s", 0),
        }
        # Dynamically include plugin aggregate metrics
        plugin_metrics = overall.get("plugin_metrics", {})
        for plugin_name, plugin_data in plugin_metrics.items():
            if isinstance(plugin_data, dict):
                for k, v in plugin_data.items():
                    if isinstance(v, (int, float)):
                        row[f"{plugin_name}.{k}"] = v
        comparison_rows.append(row)

    # --- Per-entry diff (first vs last run) ---
    first_entries = {e["id"]: e for e in reports[0].get("entries", [])}
    last_entries = {e["id"]: e for e in reports[-1].get("entries", [])}

    regressions = []  # Entries that got worse
    improvements = []  # Entries that got better
    common_ids = set(first_entries.keys()) & set(last_entries.keys())

    # Entry ids are ints in some corpora (EdTeKLA) and strings in all
    # registry-built corpora — sort by string form so a mixed or string-id
    # corpus never raises a TypeError here.
    for eid in sorted(common_ids, key=str):
        first = first_entries[eid]
        last = last_entries[eid]

        # Check if match status changed (exact match or any plugin-reported match)
        first_match = first.get("exact_match") or first.get("match")
        last_match = last.get("exact_match") or last.get("match")

        if first_match and not last_match:
            regressions.append({
                "id": eid,
                "source": first.get("source", ""),
                "expected": first.get("expected", ""),
                "first_predicted": first.get("predicted", ""),
                "last_predicted": last.get("predicted", ""),
            })
        elif not first_match and last_match:
            improvements.append({
                "id": eid,
                "source": first.get("source", ""),
                "expected": first.get("expected", ""),
                "first_predicted": first.get("predicted", ""),
                "last_predicted": last.get("predicted", ""),
            })


    # --- Significance testing (optional) ---
    sig_data = None
    if significance and len(reports) >= 2:
        if len(reports) == 2:
            # Direct pairwise test
            results = run_significance_tests(
                reports[0], reports[1], n_bootstrap=n_bootstrap
            )
            sig_data = [asdict(r) for r in results]
        else:
            # All pairwise combinations
            sig_data = []
            for i in range(len(reports)):
                for j in range(i + 1, len(reports)):
                    pair_results = run_significance_tests(
                        reports[i], reports[j], n_bootstrap=n_bootstrap
                    )
                    sig_data.append({
                        "pair": [
                            reports[i].get("run_id", f"run_{i}"),
                            reports[j].get("run_id", f"run_{j}"),
                        ],
                        "tests": [asdict(r) for r in pair_results],
                    })

    comparison = {
        "run_count": len(reports),
        "overall_comparison": comparison_rows,
        "regressions": regressions,
        "improvements": improvements,
        "regression_count": len(regressions),
        "improvement_count": len(improvements),
    }

    if sig_data is not None:
        comparison["significance"] = sig_data

    return comparison


def run_compare(
    log_paths: list[str],
    output_path: str | None = None,
    significance: bool = False,
    n_bootstrap: int = 1000,
):
    """CLI entry point for the compare subcommand.

    Accepts either RunLog or TestReport JSON files. If given RunLogs,
    it looks for corresponding _report.json files.
    """
    # Resolve report paths
    report_paths = []
    for lp in log_paths:
        path = Path(lp)
        # Try as-is first (might be a report)
        if path.exists():
            # Check if it has "overall" key (report) or "results" key (run log)
            data = json.loads(path.read_text(encoding="utf-8"))
            if "overall" in data:
                report_paths.append(path)
            elif "results" in data:
                # It's a RunLog — look for corresponding report
                report_path = path.with_name(path.stem + "_report.json")
                if report_path.exists():
                    report_paths.append(report_path)
                else:
                    print(f"  No report for {path.name} — run 'test' first")
            continue
        print(f"  WARNING: File not found: {lp}")

    if len(report_paths) < 2:
        print("  Need at least 2 reports to compare. Run 'test' on your logs first.")
        return

    comparison = compare_reports(
        report_paths,
        significance=significance,
        n_bootstrap=n_bootstrap,
    )

    # Print comparison table
    print("\n" + "=" * 80)
    print("RUN COMPARISON")
    print("=" * 80)

    rows = comparison["overall_comparison"]

    # Build column headers dynamically from core + any plugin metrics
    core_cols = ["Run ID", "Model", "Exact", "chrF++", "Cost"]
    # Find all plugin metric keys across all rows
    extra_keys = []
    for r in rows:
        for k in r:
            if "." in k and k not in extra_keys:
                extra_keys.append(k)

    # Check if any report has COMET data — only show column if so
    any_comet = any(r.get("comet_score") is not None for r in rows)

    header = f"  {'Run ID':40s} {'Model':18s} {'Exact':>7s} {'chrF++':>7s}"
    separator = f"  {'-'*40} {'-'*18} {'-----':>7s} {'------':>7s}"
    if any_comet:
        header += f" {'COMET':>7s}"
        separator += f" {'-----':>7s}"
    header += f" {'Cost':>8s}"
    separator += f" {'----':>8s}"
    for ek in extra_keys:
        short = ek.split(".")[-1][:10]
        header += f" {short:>10s}"
        separator += f" {'-'*10}"

    print(header)
    print(separator)

    for r in rows:
        flags = []
        if r["tools"]:
            flags.append("T")
        flag_str = f" [{','.join(flags)}]" if flags else ""

        line = (
            f"  {r['run_id'][:40]:40s} "
            f"{r['model']:18s} "
            f"{r['exact_match']:>6.1%} "
            f"{r['corpus_chrf']:>7.1f}"
        )
        if any_comet:
            comet = r.get("comet_score")
            if comet is not None:
                line += f" {comet:>7.4f}"
            else:
                line += f" {'N/A':>7s}"
        line += f" ${r['total_cost']:>7.4f}"
        for ek in extra_keys:
            val = r.get(ek, 0)
            if isinstance(val, float) and val <= 1.0:
                line += f" {val:>9.1%}"
            else:
                line += f" {val:>10}"
        line += flag_str
        print(line)

    # Regressions and improvements
    regs = comparison["regressions"]
    imps = comparison["improvements"]

    # Entry ids may be ints (EdTeKLA) or strings (all registry-built
    # corpora) — format via !s so a string id never hits the ':d' code.
    if imps:
        print(f"\n  IMPROVEMENTS ({len(imps)} entries now correct):")
        for item in imps[:10]:
            print(f"    #{item['id']!s:>3}: {item['source'][:50]}")
            print(f"         was: {item['first_predicted'][:50]}")
            print(f"         now: {item['last_predicted'][:50]}")

    if regs:
        print(f"\n  REGRESSIONS ({len(regs)} entries now wrong):")
        for item in regs[:10]:
            print(f"    #{item['id']!s:>3}: {item['source'][:50]}")
            print(f"         was: {item['first_predicted'][:50]}")
            print(f"         now: {item['last_predicted'][:50]}")

    # Significance tests
    if "significance" in comparison:
        sig = comparison["significance"]
        if sig and isinstance(sig[0], dict) and "metric_name" in sig[0]:
            # Direct pairwise results (2 reports)
            results = [SignificanceResult(**d) for d in sig]
            print(format_significance_table(results))
        elif sig and isinstance(sig[0], dict) and "pair" in sig[0]:
            # Multiple pairwise comparisons (>2 reports)
            for pair_data in sig:
                pair_ids = pair_data["pair"]
                print(f"\n  --- {pair_ids[0]} vs {pair_ids[1]} ---")
                results = [SignificanceResult(**d) for d in pair_data["tests"]]
                print(format_significance_table(results))

    # Write output
    if output_path is None:
        output_path = "eval/logs/harness/comparison.json"
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(comparison, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\n  Comparison written to: {out}")
    print("=" * 80)
