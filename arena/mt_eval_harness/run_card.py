"""
Run Card Renderer — Pretty-print a harness run as a human-readable CLI card.

Reads a run log JSON (and its companion _report.json) and renders a
formatted terminal card with all key metrics at a glance.

Usage:
    python -m mt_eval_harness.run_card eval/logs/harness/run_*.json
    mt-eval card eval/logs/harness/run_*.json

Design decisions:
    - Uses simple box-drawing characters (─ │ ┌ ┐ └ ┘) for structure.
    - No external dependencies (no rich, no colorama). Works in any terminal.
    - Reads both the run log and the _report.json to combine translation
      results with scored metrics in a single view.
    - Difficulty tier breakdown is always shown when available.
    - Plugin metrics are shown inline, not buried in nested JSON.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Box-drawing helpers
# ---------------------------------------------------------------------------

BOX_W = 72  # total width including borders

def _box_top() -> str:
    return "  ┌" + "─" * (BOX_W - 2) + "┐"

def _box_bot() -> str:
    return "  └" + "─" * (BOX_W - 2) + "┘"

def _box_sep() -> str:
    return "  ├" + "─" * (BOX_W - 2) + "┤"

def _box_line(text: str = "") -> str:
    """Pad text to fit inside the box with border characters."""
    inner = BOX_W - 4  # space between "│ " and " │"
    return f"  │ {text:<{inner}} │"

def _box_header(text: str) -> str:
    """Centered header text inside the box."""
    inner = BOX_W - 4
    return f"  │ {text:^{inner}} │"

def _kv(key: str, value: str, key_width: int = 22) -> str:
    """Format a key-value pair for box display."""
    return _box_line(f"{key:<{key_width}} {value}")


# ---------------------------------------------------------------------------
# Main renderer
# ---------------------------------------------------------------------------

def render_run_card(
    run_log_path: str | Path,
    report_path: str | Path | None = None,
) -> str:
    """Render a run card from a run log JSON (and optional report JSON).

    Args:
        run_log_path: Path to the run log JSON file.
        report_path: Path to the _report.json file. If None, auto-detected
                     by appending '_report' to the run log filename.

    Returns:
        Formatted string ready to print to terminal.
    """
    run_log_path = Path(run_log_path)
    run_log = json.loads(run_log_path.read_text(encoding="utf-8"))

    # Auto-detect report path
    if report_path is None:
        candidate = run_log_path.with_name(
            run_log_path.stem + "_report.json"
        )
        if candidate.exists():
            report_path = candidate

    report = None
    if report_path:
        report_path = Path(report_path)
        if report_path.exists():
            report = json.loads(report_path.read_text(encoding="utf-8"))

    # --- Extract data ---
    config = run_log.get("config", {})
    results = run_log.get("results", [])
    overall = report.get("overall", {}) if report else {}
    by_diff = report.get("by_difficulty", {}) if report else {}
    plugins = overall.get("plugin_metrics", {}) if overall else {}
    ci = overall.get("confidence_intervals", {}) if overall else {}

    # Basic config
    model = config.get("model", config.get("_model_id", "unknown"))
    # Method-plugin identity (--method path/to/dir). The runner relabels
    # config.model to the plugin's method_id, and build_run_log embeds the
    # plugin's method card in provenance — surface the method explicitly on
    # the card so a plugin run is never read as an LLM run.
    method_path = (config.get("method_path") or "").strip()
    method_card_prov = (run_log.get("provenance", {}) or {}).get("method_card") or {}
    method_label = ""
    if method_path or method_card_prov:
        method_label = (
            method_card_prov.get("method_id")
            or config.get("model", "")
            or "?"
        )
    dataset = config.get("dataset", "?")
    target_lang = config.get("target_lang", "?")
    source_lang = config.get("source_lang", "English")
    prompt = config.get("prompt_version", "?")
    temp = config.get("temperature", config.get("effective_temperature", 0))
    batch = config.get("batch_size", "?")
    max_tok = config.get("max_tokens", "?")
    concur = config.get("concurrency", "?")
    tools = "on" if config.get("tools_enabled") else "off"
    run_name = config.get("run_name", "")

    # Run metadata
    run_id = run_log.get("run_id", run_log_path.stem)
    timestamp = run_log.get("timestamp_start", "?")
    elapsed = run_log.get("elapsed_s", 0)
    total_cost = run_log.get("cost", {}).get("total_usd", 0)
    if not total_cost:
        total_cost = overall.get("total_cost_usd", 0)

    # Corpus hashes for reproducibility
    corpus_sha = run_log.get("corpus_sha256", "")[:12]
    prompt_sha = run_log.get("system_prompt_sha256", "")[:12]

    # Results
    n = len(results)
    errors = sum(1 for r in results if r.get("error"))
    evaluated = n - errors

    # Scores
    chrf = overall.get("corpus_chrf", 0)
    bleu = overall.get("corpus_bleu", 0)
    ter = overall.get("corpus_ter", 0)
    exact_n = overall.get("exact_match_count", 0)
    exact_pct = overall.get("exact_match_rate", 0) * 100 if overall else 0
    avg_lat = overall.get("avg_latency_s", 0)
    cache_hits = run_log.get("cache_hits", 0)
    comet = overall.get("comet_score")
    metricx = overall.get("metricx_score")  # LOWER is better (0–25 error score)

    # CI — the report uses full metric names (corpus_chrf, corpus_bleu,
    # exact_match_rate) with ci_lower/ci_upper fields. Try both conventions
    # for robustness.
    chrf_ci = ci.get("corpus_chrf", ci.get("chrf", {}))
    bleu_ci = ci.get("corpus_bleu", ci.get("bleu", {}))
    exact_ci = ci.get("exact_match_rate", ci.get("exact_match", {}))

    def _fmt_ci(metric_ci: dict) -> str:
        # A bootstrap interval needs ≥2 observations to be meaningful; with one
        # entry the band collapses to [score, score]. Don't render a degenerate
        # CI as if it were a real 95% interval (guards legacy reports too —
        # compute_all_cis now omits these at the source).
        if metric_ci.get("n_entries", 2) < 2:
            return ""
        lo = metric_ci.get("ci_lower", metric_ci.get("lower", 0))
        hi = metric_ci.get("ci_upper", metric_ci.get("upper", 0))
        if lo and hi and hi > lo:
            return f"[{lo:.1f} – {hi:.1f}]"
        return ""

    # --- Build output ---
    lines = []
    lines.append("")
    lines.append(_box_top())
    lines.append(_box_header("MT EVAL HARNESS — RUN CARD"))
    lines.append(_box_sep())

    # Model & config section
    lines.append(_box_line("CONFIG"))
    lines.append(_box_line())
    lines.append(_kv("Model", model))
    if method_label:
        method_str = method_label
        if method_card_prov.get("name"):
            method_str += f" ({method_card_prov['name']})"
        # Keep the box intact: _box_line pads but never truncates, and a
        # method_id + card name easily exceeds the value column.
        value_w = BOX_W - 4 - 23  # inner width minus the _kv key column
        if len(method_str) > value_w:
            method_str = method_str[: value_w - 1] + "…"
        lines.append(_kv("Method", method_str))
    lines.append(_kv("Target language", target_lang))
    lines.append(_kv("Source language", source_lang))
    lines.append(_kv("Prompt", prompt))
    lines.append(_kv("Temperature", str(temp)))
    lines.append(_kv("Batch size", str(batch)))
    lines.append(_kv("Max tokens", str(max_tok)))
    lines.append(_kv("Concurrency", str(concur)))
    lines.append(_kv("Tools", tools))
    if run_name:
        lines.append(_kv("Run name", run_name))

    lines.append(_box_sep())

    # Dataset section
    lines.append(_box_line("DATASET"))
    lines.append(_box_line())
    lines.append(_kv("Entries", f"{n:,}"))
    lines.append(_kv("Errors", f"{errors:,}"))
    lines.append(_kv("Evaluated", f"{evaluated:,}"))
    if corpus_sha:
        lines.append(_kv("Corpus SHA-256", f"{corpus_sha}…"))
    if prompt_sha:
        lines.append(_kv("Prompt SHA-256", f"{prompt_sha}…"))

    lines.append(_box_sep())

    # Scores section
    lines.append(_box_line("SCORES"))
    lines.append(_box_line())

    chrf_str = f"{chrf:.1f}"
    if chrf_ci_str := _fmt_ci(chrf_ci):
        chrf_str += f"  {chrf_ci_str}"
    lines.append(_kv("chrF++", chrf_str))

    bleu_str = f"{bleu:.1f}"
    if bleu_ci_str := _fmt_ci(bleu_ci):
        bleu_str += f"  {bleu_ci_str}"
    lines.append(_kv("BLEU", bleu_str))

    if ter:
        lines.append(_kv("TER", f"{ter:.1f}"))
    if comet is not None:
        lines.append(_kv("COMET", f"{comet:.3f}"))
    if metricx is not None:
        # ↓ = lower is better (MetricX is an error score, 0–25) — never read like COMET.
        lines.append(_kv("MetricX-24 ↓", f"{metricx:.3f} (lower=better)"))

    exact_str = f"{exact_n}/{evaluated} ({exact_pct:.1f}%)"
    # Exact match CI is stored as a rate (0.02–0.05), convert to percentage.
    # Same n<2 / zero-width guard as _fmt_ci — no fake 95% interval on a
    # single entry.
    exact_lo = exact_ci.get("ci_lower", exact_ci.get("lower", 0))
    exact_hi = exact_ci.get("ci_upper", exact_ci.get("upper", 0))
    if exact_ci.get("n_entries", 2) >= 2 and exact_lo and exact_hi and exact_hi > exact_lo:
        exact_str += f"  [{exact_lo*100:.1f}% – {exact_hi*100:.1f}%]"
    lines.append(_kv("Exact match", exact_str))

    lines.append(_box_sep())

    # Difficulty tier breakdown
    if by_diff:
        lines.append(_box_line("BY DIFFICULTY TIER"))
        lines.append(_box_line())
        # Header
        hdr = f"{'Tier':<18} {'N':>5}  {'Exact':>7}  {'chrF++':>7}  {'BLEU':>6}"
        lines.append(_box_line(hdr))
        lines.append(_box_line("─" * len(hdr)))

        tier_names = {
            "1": "Easy",
            "2": "Medium",
            "3": "Hard",
            "4": "Very Hard",
            "5": "Expert",
        }

        for tier_key in sorted(by_diff.keys(), key=lambda k: int(k) if k.isdigit() else 999):
            tier = by_diff[tier_key]
            raw_name = tier.get("name", "")
            # Prefer our human-friendly name; fall back to what the report says
            tname = tier_names.get(tier_key, raw_name or f"Tier {tier_key}")
            tn = tier.get("count", 0)
            te = tier.get("exact_match_count", 0)
            tc = tier.get("avg_chrf", 0)
            tb = tier.get("avg_bleu", 0)
            te_pct = f"{te/tn*100:.0f}%" if tn else "–"
            row = f"{tname:<18} {tn:>5}  {te_pct:>7}  {tc:>7.1f}  {tb:>6.1f}"
            lines.append(_box_line(row))

        lines.append(_box_sep())

    # Equivalence-linter metrics — GENERIC over any language's custom
    # linter, not just Cree's. A plugin opts in by emitting
    # `is_equivalence_linter: True` (or simply an `equivalent_match_rate`)
    # plus its own `display_name` and `variant_labels`. Language-specific
    # knowledge (titles, variant-class labels) lives in the plugin, never
    # here (design rule: no Cree special-casing in the generic renderer).
    raw_exact_rate = overall.get("exact_match_rate", 0)
    for plug_key, plug in plugins.items():
        if not isinstance(plug, dict):
            continue
        is_equiv = plug.get("is_equivalence_linter") or (
            "equivalent_match_rate" in plug and "variant_class_counts" in plug
        )
        if not is_equiv:
            continue

        title = plug.get("display_name") or plug_key.replace("_", " ").upper()
        lines.append(_box_line(title.upper()))
        lines.append(_box_line())

        equiv_rate = plug.get("equivalent_match_rate", 0)
        variant_counts = plug.get("variant_class_counts", {})
        variant_labels = plug.get("variant_labels", {})

        near_miss_rate = max(0, equiv_rate - raw_exact_rate)
        near_miss_n = int(near_miss_rate * evaluated) if evaluated else 0
        equiv_n = int(equiv_rate * evaluated) if evaluated else 0

        lines.append(_kv("Equivalent match", f"{equiv_n}/{evaluated} ({equiv_rate:.1%})"))
        lines.append(_kv("  ├ Exact", f"{exact_n}/{evaluated} ({raw_exact_rate:.1%})"))
        lines.append(_kv("  └ Near-miss", f"{near_miss_n}/{evaluated} ({near_miss_rate:.1%})"))

        if variant_counts:
            lines.append(_box_line())
            lines.append(_box_line("Near-miss breakdown:"))
            for vc_name, vc_count in sorted(variant_counts.items(), key=lambda x: -x[1]):
                label = variant_labels.get(vc_name, vc_name)
                lines.append(_kv(f"  {vc_name}", f"{vc_count:>3}  {label}"))

        lines.append(_box_sep())

    # FST morphological validity
    fst = plugins.get("giellalt_fst_validity", {})
    if fst:
        lines.append(_box_line("FST MORPHOLOGICAL VALIDITY"))
        lines.append(_box_line())
        fst_rate = fst.get("corpus_validity_rate", fst.get("avg_fst_validity", 0))
        fst_total = fst.get("total_words_checked", 0)
        fst_valid = fst.get("total_valid_words", 0)
        lines.append(_kv("Word validity", f"{fst_valid}/{fst_total} ({fst_rate:.1%})"))
        lines.append(_box_sep())

    # Quality signals (language-agnostic plugins)
    if plugins:
        lines.append(_box_line("QUALITY SIGNALS"))
        lines.append(_box_line())

        # Code switching
        cs = plugins.get("code_switching", {})
        if cs:
            cs_n = cs.get("entries_with_code_switching", 0)
            cs_pct = cs.get("entries_with_code_switching_pct", 0) * 100
            lines.append(_kv("Code switching", f"{cs_n} entries ({cs_pct:.1f}%)"))

        # Hallucination
        hal = plugins.get("hallucination", {})
        if hal:
            hal_n = hal.get("entries_flagged_hallucination", 0)
            hal_pct = hal.get("entries_flagged_hallucination_pct", 0) * 100
            lines.append(_kv("Hallucination", f"{hal_n} entries ({hal_pct:.1f}%)"))

        # Terminology
        term = plugins.get("terminology", {})
        if term:
            adh = term.get("avg_terminology_adherence")
            if adh is not None:
                lines.append(_kv("Terminology", f"{adh:.1%} adherence"))
            else:
                lines.append(_kv("Terminology", "no glossary (inactive)"))

        lines.append(_box_sep())

    # Cost & performance
    lines.append(_box_line("COST & PERFORMANCE"))
    lines.append(_box_line())
    lines.append(_kv("Total cost", f"${total_cost:.4f}"))

    # Calculate elapsed display
    if elapsed > 60:
        mins = int(elapsed // 60)
        secs = int(elapsed % 60)
        elapsed_str = f"{mins}m {secs}s ({elapsed:.0f}s)"
    else:
        elapsed_str = f"{elapsed:.1f}s"
    lines.append(_kv("Elapsed", elapsed_str))
    lines.append(_kv("Avg latency", f"{avg_lat:.2f}s/entry"))
    lines.append(_kv("Cache hits", f"{cache_hits:,}"))

    # Cost per entry
    if evaluated > 0:
        lines.append(_kv("Cost per entry", f"${total_cost/evaluated:.4f}"))

    lines.append(_box_sep())

    # Provenance
    lines.append(_box_line("PROVENANCE"))
    lines.append(_box_line())
    inner_val_w = BOX_W - 4 - 23  # available chars for value column
    lines.append(_kv("Run ID", run_id[:inner_val_w]))
    lines.append(_kv("Timestamp", timestamp[:inner_val_w]))
    lines.append(_kv("Log file", run_log_path.name[:inner_val_w]))

    lines.append(_box_bot())
    lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Pretty-print a run card from a harness run log.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  mt-eval card eval/logs/harness/run_*.json
  python -m mt_eval_harness.run_card eval/logs/harness/run_2026*.json
        """,
    )
    parser.add_argument(
        "files",
        nargs="+",
        help="Run log JSON file(s) to render. Companion _report.json "
             "files are auto-detected.",
    )
    args = parser.parse_args()

    for filepath in args.files:
        path = Path(filepath)
        # Skip report files — we auto-detect them from the run log
        if path.name.endswith("_report.json"):
            continue
        if not path.exists():
            print(f"  ✗ File not found: {filepath}", file=sys.stderr)
            continue
        print(render_run_card(path))


if __name__ == "__main__":
    main()
