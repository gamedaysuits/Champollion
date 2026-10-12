"""
Run Comparator — Compare multiple TestReport files side by side.

Generates a structured comparison showing how different configs
perform on the same corpus entries. Useful for answering:
    - "Did tool-calling improve accuracy?"
    - "How does Gemini compare to Claude on difficulty 5?"
    - "What's the cost/accuracy tradeoff between models?"

Also identifies per-entry regressions and improvements between runs.

THE SCORING STANDARD ("standard/1", scoring.py): which run is better is
decided by a paired significance test on corpus chrF++ — the pre-declared
primary metric, tested first and named as the decision (comparison.json
``decision``; the "Verdict" line under each pair's table). BLEU, spBLEU, TER
and COMET are tested and shown beside it as secondary metrics; exact match,
FST acceptance and the other plugin rates are shown under "Diagnostics (not
used to decide)". The weighted composite is retired: no composite row, no
composite test, no composite key in a new comparison. A report scored before
the standard (no ``overall.scoring_standard``) that carries a composite is
said ONCE to be legacy — its composite retired and not compared.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from dataclasses import asdict

from mt_eval_harness.plugin_discovery import glossary_label
from mt_eval_harness.significance import (
    SIGNIFICANCE_METHODS,
    format_significance_table,
    multiple_testing_note,
    primary_decision,
    primary_result,
    run_significance_tests,
    significance_header,
    significance_notes,
    SignificanceResult,
)


from mt_eval_harness.scoring import (
    LEGACY_COMPOSITE_LABEL,
    LEGACY_SCORING,
    PRIMARY_CI_KEY,
    PRIMARY_METRIC,
    PRIMARY_METRIC_LABEL,
    RETIRED_NOTE,
    SCORING_STANDARD,
    is_legacy_scored,
    primary_signature,
)


def _wrap_note(text: str, indent: str = "  ") -> list[str]:
    """A note wrapped to 78 columns for the terminal."""
    import textwrap
    return textwrap.wrap(text, width=78, initial_indent=indent,
                         subsequent_indent=indent + "  ",
                         break_on_hyphens=False)


#: The resampling seed compare's significance tests use (SacreBLEU's default),
#: recorded in comparison.json so a result can be reproduced exactly.
SIGNIFICANCE_SEED = 12345


def run_letters(n: int) -> list[str]:
    """The letters compare names runs by: A, B, C … (R27, R28 … past Z).
    The run table and every significance table use the same ones."""
    return [chr(ord("A") + i) if i < 26 else f"R{i + 1}" for i in range(n)]


def _fmt_chrf(value) -> str:
    """A per-entry chrF++ for a withheld-text diff line ('n/a' if absent)."""
    return f"{value:.1f}" if isinstance(value, (int, float)) else "n/a"


def _prompt_condition(config: dict) -> str:
    """The prompt condition a run card would state (run_card.prompt_label),
    with 'coached' when a coaching file replaced the default prompt."""
    from mt_eval_harness.run_card import prompt_label
    label = prompt_label(config)
    if label == "naive" and (config.get("coaching_file")
                             or config.get("custom_prompt_path")):
        return "coached"
    return label


def _file_label(path) -> str | None:
    """A file setting as its name ('coaching.json'), None when unset."""
    return Path(str(path)).name if path else None


def _source_run_log(report: dict) -> dict | None:
    """The RunLog a TestReport was computed from (its ``source_log``), when
    it is still on disk — it carries provenance the report may not (forge's
    full near-twin reading). None when absent or unreadable."""
    src = report.get("source_log")
    if not src:
        return None
    try:
        return json.loads(Path(src).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def compare_reports(
    report_paths: list[str | Path],
    significance: bool = False,
    n_bootstrap: int = 1000,
    method: str = SIGNIFICANCE_METHODS[0],
) -> dict:
    """Load and compare multiple TestReport files.

    Args:
        report_paths: Paths to TestReport JSON files (from tester.py).
        significance: If True, run paired significance tests (approximate
            randomization by default; see significance.run_significance_tests).
        n_bootstrap: Number of resampling iterations for significance testing.
        method: The paired test — "approximate_randomization" (default) or
            "paired_bootstrap" (significance.SIGNIFICANCE_METHODS).

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
            # The condition as the run card states it (prompt_label: the
            # prompt version, or why a method run has none) — the header used
            # to omit it, so two runs differing only in prompt/coaching read
            # as identical (synthetic researcher, Round 3).
            "prompt": _prompt_condition(config),
            "coaching": _file_label(config.get("coaching_file")
                                    or config.get("custom_prompt_path")),
            # The glossary that scored terminology, wherever it was given
            # (`mt-eval run` or `mt-eval test --glossary`): the report's
            # record, name + sha256 — a test-time one used to show "—".
            "glossary": (glossary_label(r.get("glossary"), short=True)
                         or _file_label(config.get("glossary_file"))),
            "temperature": config.get("_effective_temperature",
                                      config.get("temperature")),
            "dataset": config.get("dataset_id") or config.get("dataset"),
            "tools": config.get("tools_enabled", False),
            "batch_size": config.get("batch_size", 1),
            "entries": overall.get("evaluated", 0),
            "exact_match": overall.get("exact_match_rate", 0),
            # The primary metric; None (shown "—") when the report has
            # none — never a 0 that reads as a measurement.
            "corpus_chrf": overall.get("corpus_chrf"),
            "corpus_bleu": overall.get("corpus_bleu"),
            # spBLEU (FLORES-200 SentencePiece BLEU): computed for every
            # report, shown nowhere until Round 7 (synthetic researcher).
            "corpus_spbleu": overall.get("corpus_spbleu"),
            "corpus_ter": overall.get("corpus_ter"),
            "comet_score": overall.get("comet_score"),
            "comet_model": overall.get("comet_model", ""),
        }
        # The headline under the scoring standard: chrF++ with its 95%
        # bootstrap CI and sacreBLEU signature, when the report has them.
        _ci = (overall.get("confidence_intervals") or {}).get(PRIMARY_CI_KEY)
        if isinstance(_ci, dict) and _ci.get("ci_lower") is not None \
                and _ci.get("ci_upper") is not None:
            row["corpus_chrf_ci"] = [_ci["ci_lower"], _ci["ci_upper"]]
        _sig = primary_signature(overall.get("sacrebleu_signatures"))
        if _sig:
            row["chrf_signature"] = _sig
        # Which standard the report was scored under; a legacy report that
        # carries the retired composite is said once to be legacy (its
        # composite is never shown or compared here).
        row["scoring_standard"] = (overall.get("scoring_standard")
                                   or LEGACY_SCORING)
        if _carries_legacy_composite(overall):
            row["legacy_composite_not_compared"] = True
        # Latency only when it was RECORDED (run_card.latency_reading): "—"
        # and why, never a 0.00 that reads as a measurement — four runs
        # showed 0.00, two of them forge exports that had recorded 3.4 ms
        # per sentence (synthetic Cree school, Round 12).
        from mt_eval_harness.run_card import latency_reading
        _lat = latency_reading(r)
        row["avg_latency"] = _lat["avg"] if _lat["recorded"] else None
        if not _lat["recorded"]:
            row["latency_not_recorded"] = _lat["why"]
        _log = _source_run_log(r)
        # What the run cost, by the ONE rule (run_card.run_total_cost /
        # run_cost_label): the number for the JSON, the words for the
        # table. Compare used to print the report's raw number — "$0.0000"
        # for an all-cache-hit rerun beside "unknown" for a fresh run of the
        # same local model, while their cards said "$0 API cost" (synthetic
        # researcher, Round 6).
        from mt_eval_harness.run_card import run_cost_label, run_total_cost
        row["total_cost"] = run_total_cost(_log, r)
        row["cost_label"] = run_cost_label(_log, r)
        # What qualifies this run's scores (score_caveats) — forge's
        # train/test near-twin reading, length inflation. Shown in the table
        # and listed under it; a near-twinned forge run compared at chrF++
        # 100 with no caveat (synthetic hospital persona, Round 3).
        from mt_eval_harness.score_caveats import collect as _collect_caveats
        row["score_caveats"] = _collect_caveats(r, _log)
        # Dynamically include plugin aggregate metrics
        plugin_metrics = overall.get("plugin_metrics", {})
        # How FST acceptance was computed (Round 13: case-fallback/1). A
        # report scored before it looked words up case-sensitively, so its
        # FST numbers are not comparable with a newer report's.
        row["fst_acceptance_method"] = fst_acceptance_method(plugin_metrics)
        for plugin_name, plugin_data in plugin_metrics.items():
            if isinstance(plugin_data, dict):
                numeric = False
                for k, v in plugin_data.items():
                    if isinstance(v, (int, float)):
                        row[f"{plugin_name}.{k}"] = v
                        numeric = True
                # A plugin that recorded WHY it has no value ({"error":
                # "not computed: …"} / {"unavailable": "…"}) — a Cree run
                # scored without its FST used to get no row and no note at
                # all (Round 9). Kept with its stored reason for the table.
                reason = plugin_data.get("error") or plugin_data.get("unavailable")
                if reason and not numeric:
                    row.setdefault("not_computed", {})[plugin_name] = str(reason)
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
                # Per-entry chrF++ — what a restricted corpus's diff prints
                # in place of its sentences (run_compare).
                "first_chrf": first.get("chrf_score"),
                "last_chrf": last.get("chrf_score"),
            })
        elif not first_match and last_match:
            improvements.append({
                "id": eid,
                "source": first.get("source", ""),
                "expected": first.get("expected", ""),
                "first_predicted": first.get("predicted", ""),
                "last_predicted": last.get("predicted", ""),
                "first_chrf": first.get("chrf_score"),
                "last_chrf": last.get("chrf_score"),
            })


    # --- Significance testing (optional) ---
    sig_data = None
    sig_settings = None
    if significance and len(reports) >= 2:
        if method not in SIGNIFICANCE_METHODS:
            raise ValueError(
                f"Unknown significance method {method!r}; expected one of "
                f"{', '.join(SIGNIFICANCE_METHODS)}.")
        letters = run_letters(len(reports))
        # The tests' own notes (entries excluded from a pairing, metrics not
        # tested) are collected per pair and said ONCE under all the tables
        # — they printed once per pair, six times for four runs (Round 7).
        pair_notes: list[tuple[str, list[str]]] = []
        result_sets: list[list[SignificanceResult]] = []
        if len(reports) == 2:
            # Direct pairwise test
            notes: list[str] = []
            results = run_significance_tests(
                reports[0], reports[1], n_bootstrap=n_bootstrap,
                seed=SIGNIFICANCE_SEED, method=method, notes=notes,
                labels=(letters[0], letters[1]),
            )
            pair_notes.append((f"{letters[0]}–{letters[1]}", notes))
            result_sets.append(results)
            sig_data = [asdict(r) for r in results]
        else:
            # All pairwise combinations
            sig_data = []
            for i in range(len(reports)):
                for j in range(i + 1, len(reports)):
                    notes = []
                    pair_results = run_significance_tests(
                        reports[i], reports[j], n_bootstrap=n_bootstrap,
                        seed=SIGNIFICANCE_SEED, method=method, notes=notes,
                        labels=(letters[i], letters[j]),
                    )
                    pair_notes.append((f"{letters[i]}–{letters[j]}", notes))
                    result_sets.append(pair_results)
                    sig_data.append({
                        "pair": [
                            reports[i].get("run_id", f"run_{i}"),
                            reports[j].get("run_id", f"run_{j}"),
                        ],
                        # The run-table letters of the two runs: Δ is
                        # letters[0] − letters[1].
                        "letters": [letters[i], letters[j]],
                        "tests": [asdict(r) for r in pair_results],
                    })
        sig_settings = _significance_settings(
            reports, letters, result_sets, pair_notes, method, n_bootstrap)

    comparison = {
        "run_count": len(reports),
        "scoring_standard": SCORING_STANDARD,
        "primary_metric": PRIMARY_METRIC,
        "overall_comparison": comparison_rows,
        "regressions": regressions,
        "improvements": improvements,
        "regression_count": len(regressions),
        "improvement_count": len(improvements),
    }
    legacy = legacy_composite_block(comparison_rows)
    if legacy:
        comparison["legacy_composite"] = legacy

    if sig_data is not None:
        comparison["significance"] = sig_data
        comparison["significance_settings"] = sig_settings
    comparison["decision"] = comparison_decision(comparison)

    return comparison


def _carries_legacy_composite(overall: dict) -> bool:
    """A report scored BEFORE the scoring standard (no
    ``overall.scoring_standard``) that carries the retired composite — a
    published composite score or a composite confidence interval."""
    if not is_legacy_scored({"scoring_standard": overall.get("scoring_standard")}):
        return False
    if (overall.get("published_composite") or {}).get("score") is not None:
        return True
    from mt_eval_harness.confidence import LEGACY_COMPOSITE_CI_KEYS
    cis = overall.get("confidence_intervals") or {}
    return any(key in cis for key in LEGACY_COMPOSITE_CI_KEYS)


def legacy_composite_block(rows: list[dict]) -> dict | None:
    """``{runs, label, note}`` naming (by run-table letter) the compared
    reports that were scored before the scoring standard and carry the
    retired composite — None when there are none. Their composite is never
    shown or compared; this says so once."""
    letters = run_letters(len(rows))
    runs = [letter for letter, r in zip(letters, rows)
            if r.get("legacy_composite_not_compared")]
    if not runs:
        return None
    return {
        "runs": runs,
        "label": LEGACY_COMPOSITE_LABEL,
        "note": (f"{', '.join(runs)} {'was' if len(runs) == 1 else 'were'} "
                 f"scored before scoring standard/1 and "
                 f"{'carries' if len(runs) == 1 else 'carry'} a "
                 f"{LEGACY_COMPOSITE_LABEL}: it is not shown or compared "
                 f"here. {RETIRED_NOTE}"),
    }


def comparison_decision(comparison: dict) -> dict:
    """The comparison's decision, keyed on the primary metric (chrF++):

    ``{metric, label, tested, method, n_resamples, alpha, pairs, why?}`` —
    ``pairs`` holds one :func:`significance.primary_decision` per pair of
    runs (its ``better`` letter or None, and the ``verdict`` sentence).
    ``tested`` is False when no significance test was run: then no run is
    called better (a difference of two numbers decides nothing), and
    ``why`` says how to get the decision."""
    from mt_eval_harness.scoring import PRIMARY_METRIC_LABEL
    out = {"metric": PRIMARY_METRIC, "label": PRIMARY_METRIC_LABEL}
    pairs = _significance_pairs(comparison)
    if not pairs:
        out.update({
            "tested": False, "pairs": [],
            "why": (f"no paired significance test was run: which run is "
                    f"better is decided by a paired test on "
                    f"{PRIMARY_METRIC_LABEL}, never by comparing two "
                    f"numbers — rerun `mt-eval compare` with "
                    f"--significance"),
        })
        return out
    caveated = {letter for letter, r in zip(
        run_letters(len(comparison.get("overall_comparison") or [])),
        comparison.get("overall_comparison") or []) if r.get("score_caveats")}
    decisions = []
    for (la_na, lb_nb), results in pairs:
        prim = primary_result(results)
        if prim is None:   # a comparison JSON from before chrF++ was tested
            continue
        d = primary_decision(prim, (la_na, lb_nb), caveated=caveated)
        d["runs"] = [la_na[1], lb_nb[1]]
        decisions.append(d)
    settings = comparison.get("significance_settings") or {}
    first = decisions[0] if decisions else {}
    out.update({
        "tested": bool(decisions),
        "method": settings.get("method") or first.get("method"),
        "n_resamples": settings.get("n_resamples") or first.get("n_resamples"),
        "alpha": settings.get("alpha", first.get("alpha")),
        "pairs": decisions,
    })
    if not decisions:
        out["why"] = (f"the significance results carry no "
                      f"{PRIMARY_METRIC_LABEL} test")
    return out


from mt_eval_harness.plugins.giellalt_fst import (  # noqa: E402
    FST_ACCEPTANCE_METHOD_CASE_SENSITIVE as FST_METHOD_BEFORE_CASE_FALLBACK,
)


def fst_acceptance_method(plugin_metrics: dict) -> str | None:
    """How a report's FST acceptance was computed, or None (no FST score).

    ``fst_acceptance_method`` from the GiellaLT FST aggregate; a measured FST
    aggregate without it predates the key and was case-sensitive
    (``case-sensitive/0``)."""
    fst = (plugin_metrics or {}).get("giellalt_fst_validity")
    if not isinstance(fst, dict) or fst.get("error") \
            or fst.get("avg_fst_validity") is None:
        return None
    return fst.get("fst_acceptance_method") or FST_METHOD_BEFORE_CASE_FALLBACK


def fst_method_note(letters: list[str], rows: list[dict]) -> list[str]:
    """Lines saying the runs' FST acceptance was computed different ways —
    empty when every FST-scored run used the same method."""
    methods = [(letter, r.get("fst_acceptance_method"))
               for letter, r in zip(letters, rows) if r.get("fst_acceptance_method")]
    if len({m for _l, m in methods}) < 2:
        return []
    import textwrap
    def said(m: str) -> str:
        return (f"{m} (case-sensitive, before case-fallback/1)"
                if m == FST_METHOD_BEFORE_CASE_FALLBACK else m)
    text = ("⚠ FST acceptance was computed different ways: "
            + "; ".join(f"{letter} {said(m)}" for letter, m in methods)
            + ". Before case-fallback/1 a capitalised word (a sentence start, "
              "ALL CAPS) was rejected when the transducer only lists it in "
              "lower case, so those FST numbers are lower and not comparable "
              "with the others. Re-score the older run with `mt-eval test "
              "<its run log>` and compare again.")
    return textwrap.wrap(text, width=78, initial_indent="  ",
                         subsequent_indent="    ", break_on_hyphens=False)


def _merged_notes(pair_notes: list[tuple[str, list[str]]]) -> list[str]:
    """Each distinct note once; one that applies to only some pairs names
    them (e.g. "(pairs A–C, B–C)")."""
    seen: dict[str, list[str]] = {}
    for pair, notes in pair_notes:
        for note in notes:
            seen.setdefault(note, []).append(pair)
    all_pairs = len(pair_notes)
    return [note if len(pairs) == all_pairs or all_pairs == 1
            else f"{note} (pairs {', '.join(pairs)})"
            for note, pairs in seen.items()]


def _significance_settings(reports, letters, result_sets, pair_notes,
                           method, n_bootstrap) -> dict:
    """How the significance block was computed and how to read it — written
    into comparison.json beside the results, so the file says what the
    terminal says: the test, its resampling count, α, the seed, what the
    CI on Δ is, and that the p-values are per metric and uncorrected."""
    flat = [r for rs in result_sets for r in rs]
    alpha = round(1 - flat[0].confidence_level, 4) if flat else 0.05
    n_metrics = max((len(rs) for rs in result_sets), default=0)
    return {
        "method": method,
        "n_resamples": n_bootstrap,
        "alpha": alpha,
        "seed": SIGNIFICANCE_SEED,
        "runs": {letter: r.get("run_id", "?")
                 for letter, r in zip(letters, reports)},
        "delta": "first run − second run of each pair (system_a − system_b)",
        "ci": (f"ci_lower / ci_upper: {round((1 - alpha) * 100, 2):g}% "
               "bootstrap percentile interval on the delta"),
        "multiple_testing_correction": "none",
        "metrics_per_pair": n_metrics,
        "pairs": len(result_sets),
        # The pre-declared primary metric: its test alone decides (scoring
        # standard/1); every other metric is secondary or diagnostic.
        "primary_metric": PRIMARY_METRIC,
        "decision_rule": (
            f"{PRIMARY_METRIC_LABEL} (corpus_chrf) decides: a run is better "
            f"when its paired test on {PRIMARY_METRIC_LABEL} is significant "
            f"at alpha (and the bootstrap CI on the delta is not exactly "
            f"[0, 0]); the other metrics never decide"),
        "multiple_testing_note": multiple_testing_note(
            n_metrics, alpha, n_pairs=len(result_sets),
            primary=(PRIMARY_METRIC_LABEL
                     if any(primary_result(rs) for rs in result_sets)
                     else None)),
        "notes": _merged_notes(pair_notes),
    }


#: The folder a comparison of reports from DIFFERENT folders is written to,
#: inside their nearest common folder.
COMPARISONS_DIR = "comparisons"
#: Hex characters of the runs' hash in a default comparison file name.
COMPARISON_HASH_CHARS = 10


def comparison_filename(report_paths: list[str | Path]) -> str:
    """The default comparison file's NAME: ``comparison-<hash>.json``, the
    hash being the first :data:`COMPARISON_HASH_CHARS` hex characters of a
    sha256 over the compared runs' ids, in the order given (run A first) —
    each report's ``run_id``, or its resolved path when it cannot be read or
    names none. Different runs get different files; the same runs compared
    again rewrite their own. A fixed ``comparison.json`` was overwritten by
    the next compare in the same folder — inside the MCP server's results
    folder, where every run_benchmark report lives (synthetic researcher,
    Round 12). The runs it covers are inside the file
    (``overall_comparison[].run_id``)."""
    import hashlib
    keys = []
    for p in report_paths:
        path = Path(p).expanduser()
        run_id = None
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
            run_id = doc.get("run_id") if isinstance(doc, dict) else None
        except (OSError, ValueError):
            pass
        keys.append(str(run_id) if run_id else str(path.resolve()))
    digest = hashlib.sha256("\n".join(keys).encode("utf-8")).hexdigest()
    return f"comparison-{digest[:COMPARISON_HASH_CHARS]}.json"


def default_comparison_path(report_paths: list[str | Path],
                            cwd: str | Path | None = None) -> Path:
    """Where a comparison goes when -o is not given — a neutral place, never
    one run's own folder — under a name unique to the runs compared
    (:func:`comparison_filename`).

    * Reports that share one folder (a terminal ``-o results`` folder holding
      several runs): ``comparison-<hash>.json`` in that folder, beside them.
    * Reports in different folders (each ``run_benchmark`` run has its own
      ``mcp-run-<id>/``; a trained model's ``<export>/evaluation/``):
      ``comparisons/comparison-<hash>.json`` in their nearest common folder.
      It used to be the FIRST report's folder, so one run's folder looked
      like it held a cross-model comparison (Round 11 Cree school).
    * No common folder but the filesystem root (or the home directory):
      ``comparisons/comparison-<hash>.json`` under the current directory.

    It used to be eval/logs/harness/ before that — a directory the user
    never chose, away from the results it compares."""
    name = comparison_filename(report_paths)
    dirs = [Path(p).expanduser().resolve().parent for p in report_paths]
    if len(set(dirs)) == 1:
        return dirs[0] / name
    import os
    try:
        common = Path(os.path.commonpath([str(d) for d in dirs]))
    except ValueError:  # different drives (Windows)
        common = None
    if common is None or common == Path(common.anchor) or common == Path.home():
        common = Path(cwd) if cwd is not None else Path.cwd()
    return common / COMPARISONS_DIR / name


# The run table's fixed rows: (row key, label, registry name for direction,
# format). Labels are full names — the old table cut every header to ten
# characters, so four plugin keys all read "entries_wi" (synthetic
# researcher, 2026-10-03). Scoring standard/1: the STANDARD metrics first,
# chrF++ (the primary — it decides, with its 95% bootstrap CI) at the top;
# the run's cost and speed; then the diagnostics under their own heading.
# The retired composite has no row.
_STANDARD_ROWS = (
    ("corpus_chrf", "chrF++ (corpus) — primary", "corpus_chrf", "chrf"),
    ("corpus_bleu", "BLEU (corpus)", "corpus_bleu", "1f"),
    ("corpus_spbleu", "spBLEU (corpus)", "corpus_spbleu", "1f"),
    ("corpus_ter", "TER (corpus)", "corpus_ter", "1f"),
    ("comet_score", "COMET", "comet_score", "4f"),
)
_RUN_ROWS = (
    ("total_cost", "Total cost", "total_cost", "usd"),
    ("avg_latency", "Avg latency (s/entry)", "avg_latency", "latency"),
)
_DIAGNOSTIC_ROWS = (
    ("exact_match", "Exact match", "exact_match_rate", "pct"),
)
#: The heading the diagnostic rows (exact match, every plugin rate) sit under.
DIAGNOSTICS_HEADING = "Diagnostics (not used to decide):"
#: Kept for callers that iterate the run table's fixed rows.
_CORE_ROWS = _STANDARD_ROWS + _RUN_ROWS + _DIAGNOSTIC_ROWS


def _fmt_cell(value, kind: str) -> str:
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "yes" if value else "no"
    if not isinstance(value, (int, float)):
        return str(value)
    if kind == "pct":
        return f"{value:.1%}"
    if kind == "usd":
        return f"${value:.4f}"
    if kind == "latency":
        from mt_eval_harness.run_card import latency_text
        return latency_text(value)
    if kind in ("1f", "2f", "4f"):
        return f"{value:.{kind[0]}f}"
    return f"{value:,}" if isinstance(value, int) else f"{value:.4f}"


def _chrf_cell(row: dict) -> str:
    """The chrF++ cell: the score, with its 95% bootstrap CI when the report
    computed one — "47.5 [45.9, 49.0]" (scoring.format_primary without the
    metric name, which the row label carries)."""
    value = row.get("corpus_chrf")
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return "—"
    ci = row.get("corpus_chrf_ci")
    if isinstance(ci, (list, tuple)) and len(ci) == 2 \
            and all(isinstance(v, (int, float)) for v in ci):
        return f"{value:.1f} [{ci[0]:.1f}, {ci[1]:.1f}]"
    return f"{value:.1f}"


def _cost_cell(row: dict) -> str:
    """The cost cell: the head of the run's cost label (run_card.cost_label)
    — "$0 API cost", "unknown", "$0.0123"; a row from an older comparison
    JSON without a label falls back to its number."""
    label = row.get("cost_label")
    if label:
        return label.split(" (", 1)[0]
    value = row.get("total_cost")
    return "unknown" if value is None else _fmt_cell(value, "usd")


def format_comparison_table(rows: list[dict]) -> str:
    """The run comparison, transposed: one ROW per metric, one COLUMN per run.

    Runs are lettered A, B, C … (the same A/B the significance table uses)
    with a legend naming each run; metrics carry their full names and a
    direction mark from the metric registry (↑ higher is better, ↓ lower is
    better). Plugin metrics are grouped under their plugin. A metric no run
    reports is left out; a run without it shows "—".
    """
    from mt_eval_harness.metric_direction import arrow, direction_of

    letters = run_letters(len(rows))
    table: list[tuple[str, list[str]]] = [
        ("Model", [str(r.get("model", "?")) for r in rows]),
        ("Prompt (condition)", [str(r.get("prompt") or "?") for r in rows]),
    ]
    # The other settings that change a result, shown only where the runs
    # DIFFER — the header is where a reader looks for "what changed".
    for key, label in (("coaching", "Coaching file"),
                       ("glossary", "Glossary"),
                       ("temperature", "Temperature"),
                       ("batch_size", "Batch size"),
                       ("dataset", "Dataset")):
        values = [r.get(key) for r in rows]
        if len({json.dumps(v, sort_keys=True, default=str)
                for v in values}) > 1:
            table.append((label, ["—" if v is None else str(v)
                                  for v in values]))
    table.append(("Entries evaluated",
                  [_fmt_cell(r.get("entries"), "int") for r in rows]))

    def add_rows(spec) -> None:
        for key, label, reg_name, kind in spec:
            # Cost and the primary metric always have a row ("—" when
            # absent); any other metric no run reports is left out.
            if (key not in ("total_cost", "corpus_chrf")
                    and all(r.get(key) is None for r in rows)
                    and not (key == "avg_latency" and any(
                        r.get("latency_not_recorded") for r in rows))):
                continue
            # Cost in the words of the one cost rule (run_card.cost_label) —
            # "$0 API cost" / "unknown" / "$0.0123" in the cell, the reason
            # in parentheses listed under the table (it would widen every
            # column).
            cells = [_cost_cell(r) if key == "total_cost"
                     else _chrf_cell(r) if kind == "chrf"
                     else _fmt_cell(r.get(key), kind) for r in rows]
            table.append((f"{arrow(direction_of(reg_name))} {label}", cells))
    add_rows(_STANDARD_ROWS)
    add_rows(_RUN_ROWS)
    if any(r.get("tools") for r in rows):
        table.append(("Tool calling", [_fmt_cell(bool(r.get("tools")), "")
                                       for r in rows]))
    from mt_eval_harness.score_caveats import caveat_lines, short_label
    if any(r.get("score_caveats") for r in rows):
        table.append(("⚠ Score caveat", [
            "; ".join(short_label(c) for c in r.get("score_caveats") or [])
            or "—" for r in rows]))
    table.append((DIAGNOSTICS_HEADING, ["" for _ in rows]))
    add_rows(_DIAGNOSTIC_ROWS)

    plugin_keys: dict[str, list[str]] = {}
    for r in rows:
        for k in r:
            if "." in k:
                plugin, key = k.split(".", 1)
                keys = plugin_keys.setdefault(plugin, [])
                if key not in keys:
                    keys.append(key)
    for plugin, keys in plugin_keys.items():
        table.append((f"[{plugin}]", ["" for _ in rows]))
        for key in keys:
            full = f"{plugin}.{key}"
            table.append((f"{arrow(direction_of(full))}   {key}",
                          [_fmt_cell(r.get(full), "") for r in rows]))

    # Plugins a run recorded as not computed, with the stored reason: one
    # line per plugin naming the runs (grouped when their reasons agree).
    not_computed: dict[str, dict[str, list[str]]] = {}
    for letter, r in zip(letters, rows):
        for plugin, reason in (r.get("not_computed") or {}).items():
            not_computed.setdefault(plugin, {}).setdefault(reason, []).append(letter)

    label_w = max(len(label) for label, _ in table)
    col_w = max([10] + [len(v) for _, vals in table for v in vals])
    lines = ["", "  Runs:"]
    for letter, r in zip(letters, rows):
        lines.append(f"    {letter}  {r.get('run_id', '?')}")
    lines.append("")
    lines.append(f"  {'Metric':<{label_w}}  "
                 + "  ".join(f"{letter:>{col_w}}" for letter in letters))
    lines.append(f"  {'-' * label_w}  "
                 + "  ".join("-" * col_w for _ in letters))
    for label, vals in table:
        lines.append(f"  {label:<{label_w}}  "
                     + "  ".join(f"{v:>{col_w}}" for v in vals))
    if not_computed:
        import textwrap
        lines.append("")
        for plugin, by_reason in not_computed.items():
            text = (f"Not computed — [{plugin}] "
                    + "; ".join(
                        f"{', '.join(ls)}: "
                        + re.sub(r"^not computed\s*[:—-]\s*", "", reason,
                                 flags=re.I)
                        for reason, ls in by_reason.items()))
            lines.extend(textwrap.wrap(text, width=78, initial_indent="  ",
                                       subsequent_indent="    ",
                                       break_on_hyphens=False))
    gloss_note = glossary_diagnostic_note(letters, rows)
    if gloss_note:
        lines.append("")
        lines.extend(_wrap_note(gloss_note))
    sig_note = chrf_signature_note(letters, rows)
    if sig_note:
        lines.append("")
        lines.extend(_wrap_note(sig_note))
    legacy = legacy_composite_block(rows)
    if legacy:
        lines.append("")
        lines.extend(_wrap_note(legacy["note"]))
    explained = [(letter, r["cost_label"]) for letter, r in zip(letters, rows)
                 if r.get("cost_label") and r["cost_label"] != _cost_cell(r)]
    if explained:
        lines.append("")
        lines.append("  Cost: " + "; ".join(f"{letter} {label}"
                                            for letter, label in explained))
    untimed = [(letter, r["latency_not_recorded"])
               for letter, r in zip(letters, rows)
               if r.get("latency_not_recorded")]
    if untimed:
        import textwrap
        lines.append("")
        lines.extend(textwrap.wrap(
            "Avg latency — = not recorded: " + "; ".join(
                f"{letter} {why}" for letter, why in untimed),
            width=78, initial_indent="  ", subsequent_indent="    ",
            break_on_hyphens=False))
    fst_note = fst_method_note(letters, rows)
    if fst_note:
        lines.append("")
        lines.extend(fst_note)
    caveated = [(letter, r) for letter, r in zip(letters, rows)
                if r.get("score_caveats")]
    if caveated:
        lines.append("")
        lines.append("  Score caveats (they qualify the numbers above; no "
                     "score was changed):")
        for letter, r in caveated:
            for line in caveat_lines(r["score_caveats"], width=78,
                                     indent=" " * (6 + len(letter)),
                                     first_indent=f"    {letter}  "):
                lines.append(line)
    lines.append("")
    lines.append("  ↑ higher is better · ↓ lower is better · unmarked: no "
                 "better direction declared (metric registry).")
    lines.append("  chrF++/BLEU/spBLEU/TER are corpus-level (computed over "
                 "all segments at once); spBLEU = BLEU on the FLORES-200 "
                 "SentencePiece tokenizer.")
    lines.extend(_wrap_note(
        "chrF++ is the primary metric (scoring standard/1): which run is "
        "better is decided by a paired significance test on it "
        "(--significance), never by these numbers alone. [lo, hi] = its 95% "
        "bootstrap CI. Diagnostics are reported apart and never decide."))
    return "\n".join(lines)


def glossary_diagnostic_note(letters: list[str], rows: list[dict]) -> str | None:
    """When the runs' glossaries DIFFER: terminology adherence (a
    diagnostic) is comparable only between runs scored with the same
    glossary. None when they agree. It used to be said about the composite
    a glossary changed (publish.glossary_composite_note); the composite is
    retired, the diagnostic is what a glossary still changes."""
    glossaries = [r.get("glossary") for r in rows]
    if len({json.dumps(g, sort_keys=True, default=str) for g in glossaries}) < 2:
        return None
    with_g = [f"{letter} {g}" for letter, g in zip(letters, glossaries) if g]
    without = [letter for letter, g in zip(letters, glossaries) if not g]
    text = ("Glossaries differ — terminology adherence (a diagnostic) is "
            "comparable only between runs scored with the same glossary: "
            + "; ".join(with_g))
    if without:
        text += f"; {', '.join(without)} none"
    return text + ". It never enters the chrF++ decision."


def chrf_signature_note(letters: list[str], rows: list[dict]) -> str | None:
    """The chrF++ sacreBLEU signature(s) the runs' reports recorded: one
    line when they agree, per run when they differ (then the chrF++ numbers
    were computed differently and the line says so). None when no report
    recorded one."""
    sigs = [(letter, r.get("chrf_signature")) for letter, r in zip(letters, rows)
            if r.get("chrf_signature")]
    if not sigs:
        return None
    distinct = {sig for _l, sig in sigs}
    if len(distinct) == 1:
        return f"chrF++ signature: {sigs[0][1]}"
    return ("⚠ chrF++ was computed with different sacreBLEU signatures — "
            "the numbers are not strictly comparable: "
            + "; ".join(f"{letter} {sig}" for letter, sig in sigs))


def _significance_pairs(comparison: dict
                        ) -> list[tuple[tuple, list[SignificanceResult]]]:
    """The significance results of a comparison, per pair of runs:
    ``(((letter_a, run_id_a), (letter_b, run_id_b)), results)`` — from a
    two-run comparison's flat list or a multi-run comparison's per-pair
    blocks (a comparison JSON written before "letters" existed is resolved
    by run id)."""
    sig = comparison.get("significance") or []
    rows = comparison.get("overall_comparison") or []
    letters = run_letters(len(rows))
    names = {letter: str(r.get("run_id", "?")) for letter, r in zip(letters, rows)}
    by_id = {str(r.get("run_id", "?")): letter for letter, r in zip(letters, rows)}
    pairs: list[tuple[tuple, list[SignificanceResult]]] = []
    if sig and isinstance(sig[0], dict) and "metric_name" in sig[0]:
        # Direct pairwise results (2 reports)
        la, lb = (letters + ["A", "B"])[:2]
        pairs.append((((la, names.get(la)), (lb, names.get(lb))),
                      [SignificanceResult(**d) for d in sig]))
    elif sig and isinstance(sig[0], dict) and "pair" in sig[0]:
        for pair_data in sig:
            ids = [str(x) for x in pair_data["pair"]]
            pl = pair_data.get("letters") or [by_id.get(i, "?") for i in ids]
            pairs.append((((pl[0], ids[0]), (pl[1], ids[1])),
                          [SignificanceResult(**d) for d in pair_data["tests"]]))
    return pairs


def format_comparison_significance(comparison: dict) -> str:
    """compare's significance section: the explanation ONCE, one table per
    pair of runs named by their run-table letters and run ids ("A
    (baseline) vs C (nllb-ft)"), then every note ONCE.

    It used to print a fresh "A/B" table per pair — run C against run A read
    as "A … B" under a run table where A was another run — and repeated the
    header and the segment-composite note under each of them (six times for
    four runs; synthetic researcher, Round 7)."""
    rows = comparison.get("overall_comparison") or []
    letters = run_letters(len(rows))
    pairs = _significance_pairs(comparison)
    if not pairs:
        return ""
    first = next((rs for _, rs in pairs if rs), [])
    lines = significance_header(first, delta_line=(
        "  Each table names its two runs by their letters in the run table "
        "above.\n  Δ = first run − second run.  ↑ higher is better, ↓ lower "
        "is better."))
    # Runs whose scores carry a caveat (score_caveats): ⚠ on their letter in
    # every table and every "Better", and the caveat text below the tables —
    # so "Better" is never read without it (synthetic school persona, Round 8:
    # the all-data model, whose report said "recall, not translation", was
    # called Better with nothing beside it).
    caveated = {letter: r.get("score_caveats") for letter, r in zip(letters, rows)
                if r.get("score_caveats")}
    for labels, results in pairs:
        (la, na), (lb, nb) = labels
        lines.append("")
        lines.append(f"  --- {la} ({na}) vs {lb} ({nb}) ---")
        lines.append(format_significance_table(
            results, labels, header=False, notes=False,
            caveated=set(caveated)).rstrip("\n"))
    if caveated:
        from mt_eval_harness.score_caveats import caveat_lines
        lines.append("")
        lines.append("  ⚠ Score caveats — they qualify these tables, every "
                     "\"Better\" and every verdict included (no score was "
                     "changed):")
        for letter, cavs in caveated.items():
            lines.extend(caveat_lines(cavs, width=78,
                                      indent=" " * (6 + len(letter)),
                                      first_indent=f"    {letter}  "))
    decision = comparison.get("decision") or comparison_decision(comparison)
    if len(decision.get("pairs") or []) > 1:
        # Several pairs: their verdicts together, one line each (each is
        # also under its own table).
        lines.append("")
        lines.append(f"  Decision on {decision['label']} (the primary metric; "
                     f"only it decides):")
        for d in decision["pairs"]:
            lines.extend(_wrap_note(
                f"{d['pair'][0]} vs {d['pair'][1]}: {d['verdict']}",
                indent="    "))
    lines += significance_notes([rs for _, rs in pairs])
    settings = comparison.get("significance_settings") or {}
    if settings.get("notes"):
        lines.append("")
        lines.extend(f"  {note}" for note in settings["notes"])
    lines.append("")
    return "\n".join(lines)


def run_compare(
    log_paths: list[str],
    output_path: str | None = None,
    significance: bool = False,
    n_bootstrap: int = 1000,
    show_text: bool = False,
    method: str = SIGNIFICANCE_METHODS[0],
):
    """CLI entry point for the compare subcommand.

    Accepts either RunLog or TestReport JSON files. If given RunLogs,
    it looks for corresponding _report.json files.

    The per-entry was/now lines quote corpus sentences. For a run whose corpus
    may not reach an outside model (local-only, sealed, consent-required —
    transmission_policy.withheld_text_reason) they print ids and chrF++
    instead, unless ``show_text`` (``--show-text``, for a human at the
    terminal). The written comparison file is unchanged.
    """
    from mt_eval_harness.transmission_policy import withheld_text_reason

    # Resolve report paths
    report_paths = []
    withheld = ""
    for lp in log_paths:
        path = Path(lp)
        # Try as-is first (might be a report)
        if path.exists():
            # Check if it has "overall" key (report) or "results" key (run log)
            data = json.loads(path.read_text(encoding="utf-8"))
            withheld = withheld or withheld_text_reason(data)
            if "overall" in data:
                report_paths.append(path)
            elif "results" in data:
                # It's a RunLog — its report beside it, or where `mt-eval
                # test -o` recorded it in the log (run_card.find_report).
                from mt_eval_harness.run_card import find_report
                report_path, why = find_report(path, data)
                if report_path is not None:
                    report_paths.append(report_path)
                else:
                    print(f"  {path.name}: {why}")
            continue
        print(f"  WARNING: File not found: {lp}")

    if len(report_paths) < 2:
        print("  Need at least 2 reports to compare. Run 'test' on your logs first.")
        return

    comparison = compare_reports(
        report_paths,
        significance=significance,
        n_bootstrap=n_bootstrap,
        method=method,
    )

    # Print comparison table
    print("\n" + "=" * 80)
    print("RUN COMPARISON")
    print("=" * 80)

    print(format_comparison_table(comparison["overall_comparison"]))

    # Regressions and improvements
    regs = comparison["regressions"]
    imps = comparison["improvements"]

    # Entry ids may be ints (EdTeKLA) or strings (all registry-built
    # corpora) — format via !s so a string id never hits the ':d' code.
    hide = "" if show_text else withheld
    if hide and (imps or regs):
        from mt_eval_harness.transmission_policy import withheld_note
        print(f"\n  {withheld_note(hide)}")

    def _entry_lines(item: dict) -> None:
        if hide:
            print(f"    #{item['id']!s:>3}: chrF++ {_fmt_chrf(item.get('first_chrf'))}"
                  f" → {_fmt_chrf(item.get('last_chrf'))}")
            return
        print(f"    #{item['id']!s:>3}: {item['source'][:50]}")
        print(f"         was: {item['first_predicted'][:50]}")
        print(f"         now: {item['last_predicted'][:50]}")

    # The diff is first run vs last run — said by their run-table letters.
    _letters = run_letters(len(comparison["overall_comparison"]))
    first, last = _letters[0], _letters[-1]
    if imps:
        print(f"\n  IMPROVEMENTS ({len(imps)} entries wrong in {first}, "
              f"correct in {last}):")
        for item in imps[:10]:
            _entry_lines(item)

    if regs:
        print(f"\n  REGRESSIONS ({len(regs)} entries correct in {first}, "
              f"wrong in {last}):")
        for item in regs[:10]:
            _entry_lines(item)

    # Significance tests — and the decision, which only they make.
    if "significance" in comparison:
        print(format_comparison_significance(comparison))
    else:
        decision = comparison.get("decision") or {}
        print("")
        for line in _wrap_note(f"Decision: not made — {decision.get('why')}."):
            print(line)

    # Write output
    from mt_eval_harness.cache import ensure_private_dir
    from mt_eval_harness.config import DEFAULT_OUTPUT_DIR
    out = (Path(output_path) if output_path is not None
           else default_comparison_path(report_paths))
    existed = out.exists()
    # "Replaced the previous one" only for a file the user NAMED (-o): the
    # default name is unique to the runs compared, so an existing default
    # file is these same runs' earlier comparison, rewritten (Round 12).
    replaced = existed and output_path is not None
    # The comparison quotes sources and predictions — kept out of git.
    ensure_private_dir(out.parent,
                       harness_default=str(out.parent) == DEFAULT_OUTPUT_DIR)
    out.write_text(
        json.dumps(comparison, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\n  Comparison written to: {out}"
          + (" (replaced the previous one; -o names another file)"
             if replaced else ""))
    # comparison.json quotes the regressions' and improvements' sources,
    # references and outputs. Derived from a local-only / sealed /
    # consent-required corpus it carries that corpus's terms in a sidecar
    # — the terminal said "Sentence text withheld" while the file sat
    # unmarked beside it (Round 3 school persona).
    from mt_eval_harness.corpus_loader import (
        derived_file_note, derived_mark, write_derived_sidecar)
    docs = []
    for rp in report_paths:   # derived_mark also reads each report's RunLog
        try:
            docs.append(json.loads(Path(rp).read_text(encoding="utf-8")))
        except (OSError, ValueError):
            continue
    mark = derived_mark(*docs)
    stale = Path(str(out) + ".champollion.json")
    if mark:
        write_derived_sidecar(
            out, mark, derived_from=", ".join(Path(rp).name for rp in report_paths),
            written_by="mt-eval compare")
        print(derived_file_note(out, mark))
    elif stale.is_file() and existed:
        # A previous comparison of protected runs left its mark here; the
        # new contents are not protected, but never silently drop a mark.
        print(f"  {stale.name} from an earlier comparison is kept (a mark "
              "is never removed automatically) — delete it yourself if the "
              "new comparison holds no protected text")
    print("=" * 80)
