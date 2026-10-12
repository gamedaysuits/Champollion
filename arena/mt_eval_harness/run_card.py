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


def _wrap(text: str, width: int) -> list[str]:
    """Word-wrap ``text`` to ``width`` columns (the box never truncates a
    caveat or a count — it wraps it onto more lines)."""
    import textwrap
    return textwrap.wrap(text, width=width) or [""]


# ---------------------------------------------------------------------------
# Labels shared with the runner's end-of-run summary
# ---------------------------------------------------------------------------

def runs_on_this_machine(config: dict, provenance: dict) -> bool:
    """True when the run made no API call: VERIFIABLY — a --provider local
    run whose endpoint the runner recorded as loopback, or a model decoded in
    this process (the harness's local-model adapter, an nmt-forge export),
    ``provenance.endpoint_locality`` — or, for a method plugin (run in this
    process by the harness), by the dependency class its method.json
    DECLARES: S or O with no gateway / external-api dependency
    (method_loader.plugin_calls_no_api, read from
    ``provenance.method_plugin``). The methods spec says an S or O plugin
    calls no API; an S plugin with ``dependencies: []`` was still reported
    "unknown (plugin prices its own calls)" on every surface (synthetic
    researcher, Round 12). The one test behind the cost wording
    (:func:`cost_label`) and the report's ``cost_unknown`` / ``api_cost_usd``
    (tester), so the two can never disagree."""
    config = config or {}
    provenance = provenance or {}
    locality = provenance.get("endpoint_locality")
    if config.get("provider") == "local" and locality == "loopback":
        return True
    if locality == "in-process":
        return True
    if (config.get("method_path") or "").strip() and not config.get("mt_method"):
        from mt_eval_harness.method_loader import plugin_calls_no_api
        return plugin_calls_no_api(provenance.get("method_plugin"))
    return False


def cost_label(total_cost, config: dict, provenance: dict) -> str:
    """How to SAY a run's cost. Never changes the number.

    ``total_cost`` is None when no entry carried a price — the stored value
    stays None either way (a fabricated $0 would win every cost comparison).
    What changes is the explanation: a --provider local run whose endpoint
    was recorded as loopback (runner, provenance.endpoint_locality) had no
    API bill at all, which "unknown (model has no published price)" hid from
    the hospital persona (2026-10-03).
    """
    if total_cost is not None:
        return f"${total_cost:.4f}"
    config = config or {}
    provenance = provenance or {}
    if runs_on_this_machine(config, provenance):
        # a loopback endpoint, or a model decoded in this process: no API
        # exists to bill
        return "$0 API cost (runs on this machine)"
    if config.get("provider") == "external":
        # Outputs scored as a file (contest qualify, a node's re-execution,
        # submitted hypotheses). When the file is a harness run log or
        # TestReport, the harness DID make them — that run's own cost, never
        # "made outside the harness" (synthetic researcher, Round 13: qualify
        # said both "made outside the harness" and "Produced by: harness
        # LLM, model stub-1").
        src = outputs_from_run(config)
        if src and src.get("cost_label"):
            return (f"{src['cost_label']} — as the harness {src.get('kind') or 'run'} "
                    f"{src.get('run_id') or ''} recorded it; re-scoring it "
                    f"here cost nothing").replace("  ", " ")
        return ("unknown (outputs made outside the harness; scoring them "
                "cost nothing)")
    if config.get("mt_method"):
        return "unknown (engine has no published price)"
    if (config.get("method_path") or "").strip():
        return "unknown (plugin prices its own calls)"
    return "unknown (model has no published price)"


def run_total_cost(run_log: dict | None = None,
                   report: dict | None = None) -> float | None:
    """A run's actual API spend — the ONE reading every surface uses.

    The RunLog's ``total_cost_usd`` is the recorded value (pipeline.
    enrich_results: None when the model carries no price, whatever the cache
    served). Without a RunLog, the TestReport: its ``overall.total_cost_usd``
    — unless it says ``cost_unknown``, or no entry carries a price (a report
    written before 2026-10-03 recorded $0 for an all-cache-hit rerun of an
    unpriced model, so compare showed "$0.0000" beside "unknown" for two runs
    of one local model — synthetic researcher, Round 6). Never changes a
    recorded number; decides which one is the run's.
    """
    if isinstance(run_log, dict):
        if "total_cost_usd" in run_log:
            return run_log.get("total_cost_usd")
        legacy = (run_log.get("cost") or {}).get("total_usd")
        if legacy is not None:
            return legacy
    overall = (report or {}).get("overall") or {}
    if overall.get("cost_unknown"):
        return None
    entries = [e for e in (report or {}).get("entries") or []
               if isinstance(e, dict) and not e.get("error")]
    if entries and all(e.get("cost_usd") is None for e in entries):
        return None
    return overall.get("total_cost_usd")


def run_locality(run_log: dict | None = None,
                 report: dict | None = None) -> tuple[dict, dict]:
    """``(config, provenance)`` for the cost rule: the RunLog's, with the
    endpoint locality the report carries (recorded by the tester) when the
    RunLog is absent or lacks it."""
    run_log = run_log if isinstance(run_log, dict) else {}
    report = report if isinstance(report, dict) else {}
    config = run_log.get("config") or report.get("config") or {}
    provenance = dict(run_log.get("provenance") or {})
    if not provenance.get("endpoint_locality") and report.get("endpoint_locality"):
        provenance["endpoint_locality"] = report["endpoint_locality"]
    # A method plugin's declared dependency class (tester copies it into the
    # report as ``method_plugin``), so a report read without its RunLog
    # says the plugin's cost the same way (Round 12).
    if (not isinstance(provenance.get("method_plugin"), dict)
            and isinstance(report.get("method_plugin"), dict)):
        provenance["method_plugin"] = report["method_plugin"]
    return config, provenance


def run_cost_label(run_log: dict | None = None,
                   report: dict | None = None) -> str:
    """:func:`cost_label` for a run, from its RunLog and/or TestReport —
    the one call compare, the dashboard, the test summary, the run card and
    the publish preview make, so one run reads one way everywhere. The
    endpoint locality comes from the RunLog provenance, else from the copy
    the report carries (``endpoint_locality``, recorded by the tester)."""
    run_log = run_log if isinstance(run_log, dict) else {}
    report = report if isinstance(report, dict) else {}
    config, provenance = run_locality(run_log, report)
    return cost_label(run_total_cost(run_log or None, report), config,
                      provenance)


def cost_estimate_label(est_cost, est_basis: str, config: dict,
                        provenance: dict) -> str:
    """How to SAY a pre-spend estimate — the dry run's and the real run's
    "Est. cost" line — by the same rule as the total (:func:`cost_label`):
    a model that provably runs on this machine (loopback endpoint, or the
    harness's own in-process adapter) has "$0 API cost" before the run
    exactly as after it; any other unpriced run is "unknown"."""
    if est_cost is not None:
        return f"~${est_cost:.4f} ({est_basis})"
    said = cost_label(None, config, provenance)
    if said.startswith("$0 API cost"):
        # A plugin's "$0" rests on the dependency class it declares — say
        # which (api.estimate_run_cost: method_loader.plugin_cost_basis).
        if ((config or {}).get("method_path") or "").strip() and est_basis:
            return f"{said} — {est_basis}"
        return said
    return f"unknown — {est_basis}"


def outputs_made_outside(config: dict) -> bool:
    """True when the harness only SCORED the outputs — a hypotheses file
    (contest qualify, a node's re-execution, submitted hypotheses): the
    config records provider "external" (the same test :func:`cost_label`
    makes). No model call, prompt, temperature, batch or max tokens of the
    harness touched them."""
    return (config or {}).get("provider") == "external"


#: The one row every surface shows for outputs made outside the harness.
EXTERNAL_OUTPUTS_NA = ("made outside the harness and scored as a file — no "
                       "model call, prompt, temperature, batch size or max "
                       "tokens of the harness applied")


def outputs_from_run(config: dict) -> dict | None:
    """The harness run a scored file's outputs came from, or None.

    Recorded by ``external_scoring.score_hypotheses`` (config
    ``outputs_from_run``: kind, run_id, model, method, cost_label) when the
    hypotheses file is a harness run log or TestReport — the outputs were
    made BY the harness, in that run, and only re-scored as a file here."""
    config = config or {}
    src = config.get("outputs_from_run")
    return src if outputs_made_outside(config) and isinstance(src, dict) else None


def outputs_line(config: dict) -> str:
    """The "Outputs" row for a scored file — ONE true statement of where the
    outputs came from: a harness run (re-scored from its log), or outside
    the harness (:data:`EXTERNAL_OUTPUTS_NA`)."""
    src = outputs_from_run(config)
    if not src:
        return EXTERNAL_OUTPUTS_NA
    who = src.get("method") or src.get("model")
    return (f"made by the harness in {src.get('kind') or 'run'} "
            f"{src.get('run_id') or '(no id)'}"
            + (f" ({who})" if who else "")
            + " and re-scored here from that file — no new model call; that "
              "run's card holds its prompt and settings")


def prompt_label(config: dict) -> str:
    """The prompt condition — or why there is none (engine / plugin run,
    outputs made outside the harness)."""
    config = config or {}
    if outputs_made_outside(config):
        if outputs_from_run(config):
            return "n/a here (re-scored from a harness run; its card holds the prompt)"
        return "n/a (outputs made outside the harness)"
    if config.get("mt_method") or (config.get("method_path") or "").strip():
        return "n/a (method translates by itself)"
    return str(config.get("prompt_version", "?"))


def llm_settings_apply(config: dict) -> bool:
    """True when the run went through the harness's own LLM path, so its
    temperature, max tokens, prompt, concurrency and tool settings shaped the
    output. False for an MT engine (--method google-translate) or a method
    plugin (--method <dir>): those translate by themselves and never see
    the settings, which stay at their defaults in the stored config (the
    fingerprint and the database still read them there)."""
    config = config or {}
    return not (config.get("mt_method")
                or (config.get("method_path") or "").strip()
                or outputs_made_outside(config))


#: The one line every surface shows in place of the LLM-only settings.
LLM_SETTINGS_NA = ("n/a — the method translates by itself (no temperature, "
                   "max tokens, prompt or concurrency)")


def run_settings_rows(config: dict) -> list[tuple[str, str]]:
    """(key, value) rows for the settings that APPLY to this run.

    The harness's own LLM path: prompt, temperature, batch size, max tokens,
    concurrency, tools. An MT engine or a method plugin: only the batch size,
    labelled for what it is there — how many entries one ``translate()``
    call receives — plus one row saying the LLM settings do not apply. A
    forge-trained model's run card used to list temperature 0, max tokens
    4096 and "Prompt: n/a" as if they had been used (synthetic hospital
    persona, Round 4). Display only: the stored run card keeps every field.
    """
    config = config or {}
    batch = str(config.get("batch_size", "?"))
    if outputs_made_outside(config):
        # A hypotheses file: nothing of the harness's made the outputs, not
        # even a translate() call. The qualify header listed temperature
        # 0.0, batch size 25, max tokens 32768 and "Prompt: hypotheses-
        # submission" for one (synthetic researcher, Round 12).
        return [("Outputs", outputs_line(config))]
    if not llm_settings_apply(config):
        return [("Batch size", f"{batch} entries per translate() call"),
                ("LLM settings", LLM_SETTINGS_NA)]
    temp = config.get("_effective_temperature",
                      config.get("temperature",
                                 config.get("effective_temperature", 0)))
    return [
        ("Prompt", prompt_label(config)),
        ("Temperature", str(temp)),
        ("Batch size", batch),
        ("Max tokens", str(config.get("max_tokens", "?"))),
        ("Concurrency", str(config.get("concurrency", "?"))),
        ("Tools", "on" if config.get("tools_enabled") else "off"),
    ]


def latency_reading(report: dict | None = None,
                    results: list[dict] | None = None,
                    config: dict | None = None) -> dict:
    """Whether a run's per-entry latency was RECORDED, and how to show it.

    An entry's time is recorded when it was not served from the cache and
    carries a ``latency_s`` above zero. A real call always takes time, so a
    run where no entry carries one did not time its outputs: every entry
    came from the cache, the outputs were made outside the harness (a
    hypotheses file), a method reported no time, or — runs before this
    version — a fast batch's per-entry share was rounded to 0 at 1 ms.
    ``mt-eval compare`` showed "Avg latency 0.00" for four runs including
    two forge exports that HAD recorded 3.4 ms per sentence (2-decimal
    format) beside stub runs that had recorded nothing (synthetic Cree
    school, Round 12). Returns ``{"recorded": int, "avg": float | None,
    "why": str | None}`` — ``avg`` the report's ``avg_latency_s`` (or the
    mean over the entries) when anything was recorded, else None and
    ``why`` says what happened."""
    report = report or {}
    rows = [e for e in (results if results is not None
                        else report.get("entries") or [])
            if isinstance(e, dict) and not e.get("error")]
    config = config or report.get("config") or {}
    timed = [e for e in rows if not e.get("cached")
             and isinstance(e.get("latency_s"), (int, float))
             and not isinstance(e.get("latency_s"), bool)
             and e["latency_s"] > 0]
    if timed:
        avg = (report.get("overall") or {}).get("avg_latency_s")
        if not isinstance(avg, (int, float)) or avg <= 0:
            avg = sum(e["latency_s"] for e in rows
                      if isinstance(e.get("latency_s"), (int, float))) / len(rows)
        return {"recorded": len(timed), "avg": avg, "why": None}
    if not rows:
        why = "no entry was translated"
    elif all(e.get("cached") for e in rows):
        why = "every entry was served from the cache (no call was timed)"
    elif outputs_made_outside(config):
        why = ("the outputs were re-scored from a harness run's file (nothing "
               "was timed here)" if outputs_from_run(config)
               else "the outputs were made outside the harness (nothing was "
                    "timed)")
    elif config.get("mt_method") or (config.get("method_path") or "").strip():
        why = "the method reported no time for its calls"
    else:
        why = ("no entry carries a time above zero (before this version a "
               "fast batch's per-entry share was rounded to 0 at 1 ms)")
    return {"recorded": 0, "avg": None, "why": why}


def latency_text(seconds: float | None) -> str:
    """Seconds per entry with the precision the number needs: a forge model
    decoding at 3.4 ms read as "0.00" at two decimals (Round 12)."""
    if seconds is None:
        return "—"
    if seconds >= 0.01:
        return f"{seconds:.2f}"
    if seconds >= 0.0001:
        return f"{seconds:.4f}"
    return "<0.0001"


def fst_lines(fst: dict) -> list[tuple[str, str]]:
    """(key, value) rows for the FST block: the PUBLISHED number first.

    The leaderboard's ``fst_acceptance_rate`` is ``avg_fst_validity`` — the
    MEAN OF PER-ENTRY acceptance rates (publish.py). The card used to print
    only ``corpus_validity_rate`` — accepted words / all words — as "Word
    validity 11/249 (4.4%)" beside a published 3.9%. Both are shown, each
    named for how it is aggregated.
    """
    rows: list[tuple[str, str]] = []
    macro = fst.get("avg_fst_validity")
    micro = fst.get("corpus_validity_rate")
    total = fst.get("total_words_checked", 0)
    valid = fst.get("total_valid_words", 0)
    if isinstance(macro, (int, float)):
        rows.append(("FST acceptance", f"{macro:.1%}  (published: mean of per-entry rates)"))
    if isinstance(micro, (int, float)):
        rows.append(("Words accepted", f"{valid}/{total} ({micro:.1%}, all words pooled)"))
    if not rows:
        rows.append(("FST acceptance", fst.get("error") or "not measured"))
    return rows


#: How each machine-parseable metric_availability prefix reads on a card.
_AVAILABILITY_WORDS = {
    "unavailable": "not computed",
    "not_computed": "not computed",
    "below_coverage_floor": "below the coverage floor",
    "not_run": "not run",
    "not_applicable": "n/a",
    "not_implemented": "not implemented",
}


def availability_value(overall: dict, metric: str) -> str | None:
    """The card's words for a null metric, from the report's
    ``metric_availability`` (publish._build_metric_availability): e.g.
    "not computed — unbabel-comet is not installed — mt-eval setup --comet".
    None when the report records no reason for it (a report written before
    the block existed, or a metric that was computed)."""
    reason = ((overall or {}).get("metric_availability") or {}).get(metric)
    if not reason:
        return None
    prefix, _, detail = str(reason).partition(": ")
    words = _AVAILABILITY_WORDS.get(prefix)
    if words is None:
        return str(reason)
    return f"{words} — {detail}" if detail else words


# ---------------------------------------------------------------------------
# Which report belongs to a run log
# ---------------------------------------------------------------------------

#: The RunLog key where `mt-eval test -o <path>` records a report it wrote
#: anywhere other than beside the log (``<log>_report.json``), so `card`,
#: `compare` and the publish prompt find it. A card of a run scored with
#: `test -o` used to print "chrF++ 0.0 / BLEU 0.0" for real scores of
#: 8.2 / 0.5, without saying it had found no report (Round 9 researcher).
REPORT_PATHS_KEY = "report_paths"


class ReportPairingError(ValueError):
    """A report named explicitly (``card --report``) that is missing,
    unreadable, or the report of another run."""


def default_report_path(run_log_path) -> Path:
    """Where `mt-eval test` writes a run log's report without ``-o``."""
    p = Path(run_log_path)
    return p.with_name(p.stem + "_report.json")


def _read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _same_run(report: dict, run_log: dict) -> bool:
    """A report belongs to a run when their run ids agree (a report or log
    without one cannot be told apart, and is accepted)."""
    a, b = report.get("run_id"), (run_log or {}).get("run_id")
    return not a or not b or a == b


def find_report(run_log_path, run_log: dict | None = None,
                report_path=None) -> tuple[Path | None, str]:
    """The TestReport of a run log: ``(path, how it was found)``, or
    ``(None, why there is none)`` — never a guess.

    An explicit ``report_path`` (``card --report``) must exist, be a report
    and belong to this run, else :class:`ReportPairingError`. Otherwise the
    candidates are the default ``<log>_report.json`` and every path
    ``mt-eval test -o`` recorded in the log (:data:`REPORT_PATHS_KEY`); of
    those that exist and belong to this run, the newest file wins.
    """
    run_log_path = Path(run_log_path)
    if run_log is None:
        run_log = _read_json(run_log_path) or {}
    if report_path is not None:
        rp = Path(report_path).expanduser()
        data = _read_json(rp) if rp.is_file() else None
        if data is None:
            raise ReportPairingError(
                f"--report {report_path}: "
                + ("no such file" if not rp.is_file()
                   else "not a readable JSON report"))
        if not isinstance(data, dict) or "overall" not in data:
            raise ReportPairingError(
                f"--report {report_path}: not a TestReport (no 'overall' "
                f"block) — `mt-eval test <run log> -o <path>` writes one.")
        if not _same_run(data, run_log):
            raise ReportPairingError(
                f"--report {report_path} is the report of run "
                f"{data.get('run_id')!r}, not of {run_log.get('run_id')!r} "
                f"— a card pairs a run log with its own report only.")
        return rp, f"named with --report ({rp.name})"

    default = default_report_path(run_log_path)
    candidates: list[Path] = [default]
    seen = {default.resolve()}
    for recorded in (run_log.get(REPORT_PATHS_KEY) or []):
        p = Path(str(recorded)).expanduser()
        if p.resolve() not in seen:
            seen.add(p.resolve())
            candidates.append(p)
    found: list[Path] = []
    other_run: list[Path] = []
    for p in candidates:
        if not p.is_file():
            continue
        data = _read_json(p)
        if not isinstance(data, dict) or "overall" not in data:
            continue
        if _same_run(data, run_log):
            found.append(p)
        else:
            other_run.append(p)
    if found:
        best = max(found, key=lambda p: p.stat().st_mtime)
        how = ("beside the run log" if best == default
               else "the path `mt-eval test -o` recorded in the run log")
        return best, f"{best.name} ({how})"
    recorded_n = len(candidates) - 1
    why = (f"no report found for this run log — looked for {default.name} "
           f"beside it"
           + (f" and the {recorded_n} report path"
              f"{'s' if recorded_n != 1 else ''} the log records"
              if recorded_n else "")
           + (f" ({', '.join(p.name for p in other_run)} belong"
              f"{'s' if len(other_run) == 1 else ''} to another run)"
              if other_run else "")
           + f". Score it with `mt-eval test {run_log_path.name}`, or pass "
             f"--report <path> if its report was written elsewhere.")
    return None, why


def card_inputs(path) -> tuple[Path, Path | None]:
    """``(run log, report or None)`` for a file given to `mt-eval card`.

    A run log comes back as itself (its report is found by
    :func:`find_report`). A TestReport — whatever its name, ``test -o`` may
    have called it anything — comes back as the run log it records
    (``source_log``) or the one beside it by name, paired with itself.
    Raises :class:`ReportPairingError` when a report's run log is not on
    this machine (a card needs the log: the config and the translations)."""
    path = Path(path)
    data = _read_json(path) if path.is_file() else None
    if not (isinstance(data, dict) and "overall" in data
            and "results" not in data):
        return path, None
    candidates = []
    if data.get("source_log"):
        candidates.append(Path(str(data["source_log"])).expanduser())
    if path.name.endswith("_report.json"):
        candidates.append(path.with_name(
            path.name[: -len("_report.json")] + ".json"))
    for log in candidates:
        if log.is_file():
            return log, path
    raise ReportPairingError(
        f"'{path}' is a report file, not a run log, and the run log it "
        f"was computed from is not here"
        + (f" ({candidates[0]})" if candidates else "")
        + ". Pass the run log, with --report " + path.name + ".")


def record_report_path(run_log_path, report_path) -> str | None:
    """Record in the run log where its report was written, when that is not
    the default ``<log>_report.json`` (``mt-eval test -o``). Returns None
    when recorded (or nothing needed recording), else the reason it could
    not be — the caller prints it, so a card that later finds no report is
    never a surprise."""
    log = Path(run_log_path)
    rp = Path(report_path).resolve()
    if rp == default_report_path(log).resolve():
        return None
    data = _read_json(log)
    if not isinstance(data, dict):
        return f"{log.name} is not readable JSON"
    paths = [str(p) for p in (data.get(REPORT_PATHS_KEY) or [])]
    if str(rp) in paths:
        return None
    data[REPORT_PATHS_KEY] = paths + [str(rp)]
    try:
        log.write_text(json.dumps(data, ensure_ascii=False, indent=2),
                       encoding="utf-8")
    except OSError as exc:
        return f"{log.name} could not be written ({exc.strerror or exc})"
    return None


# ---------------------------------------------------------------------------
# Main renderer
# ---------------------------------------------------------------------------

def composite_card_lines(overall: dict,
                         glossary: dict | None = None) -> list[str]:
    """The card's line about the RETIRED composite (scoring standard/1).

    A report scored under the standard carries no composite: nothing is
    shown (the chrF++ headline is the card's number). A report written
    before the standard may carry ``published_composite``: its stored score
    is shown only as ``legacy composite (retired)`` — never with a quality
    tier, never as a headline. ``glossary`` is unused (kept for callers)."""
    if (overall or {}).get("scoring_standard"):
        return []
    pub = (overall or {}).get("published_composite")
    if isinstance(pub, dict) and isinstance(pub.get("score"), (int, float)):
        # scoring.LEGACY_COMPOSITE_LABEL, split over the key/value columns.
        return [_kv("Legacy composite", f"{pub['score']:.4f} (retired; "
                                        "not a headline)")]
    return []


def render_run_card(
    run_log_path: str | Path,
    report_path: str | Path | None = None,
) -> str:
    """Render a run card from a run log JSON (and optional report JSON).

    Args:
        run_log_path: Path to the run log JSON file.
        report_path: The report to show (``card --report``): it must exist
                     and be this run's (:class:`ReportPairingError`). None
                     finds it (:func:`find_report`): beside the log, or where
                     ``mt-eval test -o`` recorded it.

    Returns:
        Formatted string ready to print to terminal. Without a report the
        SCORES section says so and why — never a 0.0 standing in for a score.
    """
    run_log_path = Path(run_log_path)
    run_log = json.loads(run_log_path.read_text(encoding="utf-8"))

    # A named report that was never written (the run's own end-of-run card
    # after a failed analysis) is looked for like any other — and its absence
    # said; a named file that exists must be this run's report.
    named = (report_path if report_path is not None
             and Path(report_path).expanduser().is_file() else None)
    found, report_note = find_report(run_log_path, run_log, named)
    report = None
    if found is not None:
        report_path = found
        report = json.loads(found.read_text(encoding="utf-8"))

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
    # A code given where the prompt needs a name (--target-lang sme): the
    # card says the name came from the code — or that no card named it and
    # the prompt carried the code (prompt_plan, Round 11).
    _res = config.get("target_lang_resolution") or {}
    if _res.get("given"):
        target_lang = (f"{target_lang} (named from the code {_res['given']} "
                       f"by its language card)" if _res.get("resolved")
                       else f"{_res['given']} — a code no language card "
                            f"names; the prompt carried the code")
    source_lang = config.get("source_lang", "English")
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
    # The one reading of what the run cost (run_total_cost) — this card used
    # to fall back to the report's $0 for an all-cache-hit rerun of an
    # unpriced model while publish read the RunLog's None.
    total_cost = run_total_cost(run_log, report)

    # Corpus hashes for reproducibility. The run log records both under
    # provenance (pipeline.build_run_log); the top-level keys are read too
    # for a log written in another shape. Reading only the top level showed
    # neither hash on any run card.
    _prov = run_log.get("provenance") or {}
    corpus_sha = (run_log.get("corpus_sha256")
                  or _prov.get("corpus_sha256") or "")[:12]
    prompt_sha = (run_log.get("system_prompt_sha256")
                  or _prov.get("system_prompt_sha256") or "")[:12]

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
    # (Avg latency: latency_reading, below — with no report it reads the run
    # log's own per-entry times, a timing, not a score.)
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
    # The model an engine ran (--method local-model -m <model>): what loaded,
    # not just the engine's name — a local-model run used to read "Model
    # local-model" and nothing else, whichever weights produced it (Round 10).
    from mt_eval_harness import decode_length as _dl
    from mt_eval_harness import engine_model as _em
    _engine = _em.from_run(config, run_log.get("provenance") or {})
    if _engine:
        for i, chunk in enumerate(_wrap(_em.label(_engine), BOX_W - 4 - 23)):
            lines.append(_kv("Engine model" if i == 0 else "", chunk))
        if _engine.get("decode"):
            for i, chunk in enumerate(_wrap(_dl.summary(_engine["decode"]),
                                            BOX_W - 4 - 23)):
                lines.append(_kv("Decode length" if i == 0 else "", chunk))
        if _engine.get("pair_mismatch"):
            _pm = _engine["pair_mismatch"]
            for i, chunk in enumerate(_wrap(
                    f"model is for {_pm.get('model_pair')}, run is "
                    f"{_pm.get('run_pair')} (run on purpose)", BOX_W - 4 - 23)):
                lines.append(_kv("⚠ Pair mismatch" if i == 0 else "", chunk))
    elif _em.engine_requires_model(config):
        for i, chunk in enumerate(_wrap(
                "NOT RECORDED — this run log names no model (harness before "
                "Round 10 dropped -m; the engine may have run "
                "opus-mt-en-es). Re-run to know.", BOX_W - 4 - 23)):
            lines.append(_kv("Engine model" if i == 0 else "", chunk))
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
    for i, chunk in enumerate(_wrap(str(target_lang), BOX_W - 4 - 23)):
        lines.append(_kv("Target language" if i == 0 else "", chunk))
    lines.append(_kv("Source language", source_lang))
    # Only the settings that applied to this run (run_settings_rows): an
    # engine or a plugin shows its batch size and one "n/a" line instead of
    # LLM settings it never saw.
    for key, value in run_settings_rows(config):
        for i, chunk in enumerate(_wrap(value, BOX_W - 4 - 23)):
            lines.append(_kv(key if i == 0 else "", chunk))
    if run_name:
        lines.append(_kv("Run name", run_name))
    # What the model was instructed with, as a pointer to where the full text
    # is (the run log on this machine) — the coaching file's name and sha256,
    # the system prompt's sha256. A published card may redact the prompt (a
    # local-only corpus); the user's own card says what the model got.
    from mt_eval_harness.tester import instructions_line, instructions_pointer
    _instr = instructions_line(
        (report or {}).get("instructions")
        or instructions_pointer(run_log, str(run_log_path)))
    if _instr:
        for i, chunk in enumerate(_wrap(_instr, BOX_W - 4 - 23)):
            lines.append(_kv("Instructions" if i == 0 else "", chunk))

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
    # What qualifies these numbers, ABOVE them (score_caveats): nmt-forge's
    # train/test near-twin reading, the length-inflation check. A 150/150
    # near-twinned forge test set used to show a bare "chrF++ 100.0" here.
    from mt_eval_harness.score_caveats import caveat_lines, collect
    caveats = collect(report, run_log)
    if caveats:
        for line in caveat_lines(caveats, width=BOX_W - 4, indent=""):
            lines.append(_box_line(line))
        lines.append(_box_line())

    if report is None:
        # No report: say so, and where it was looked for — a card used to
        # print "chrF++ 0.0 / BLEU 0.0 / Exact 0/N" for a run scored with
        # `test -o` elsewhere (real scores 8.2 / 0.5; Round 9 researcher).
        for i, chunk in enumerate(_wrap(f"NOT SCORED — {report_note}",
                                        BOX_W - 4)):
            lines.append(_box_line(chunk))
    else:
        chrf_str = f"{chrf:.1f}"
        if chrf_ci_str := _fmt_ci(chrf_ci):
            chrf_str += f"  {chrf_ci_str}"
        # "corpus": computed over all segments at once (sacreBLEU corpus_score)
        # — the published value. The tier table below shows the MEAN of
        # per-sentence scores, a different statistic (BLEU especially: 0.5 here
        # beside 10.2 for a tier is not a contradiction), so both are named.
        lines.append(_kv("chrF++ (corpus)", chrf_str))
        # The headline's scoring standard and the chrF++ sacreBLEU signature
        # (scoring standard/1: chrF++ ranks; the rest is shown beside).
        from mt_eval_harness.scoring import primary_signature
        _sig = primary_signature(overall.get("sacrebleu_signatures"))
        if _sig:
            for i, chunk in enumerate(_wrap(_sig, BOX_W - 4 - 23)):
                lines.append(_kv("  signature" if i == 0 else "", chunk))

        bleu_str = f"{bleu:.1f}"
        if bleu_ci_str := _fmt_ci(bleu_ci):
            bleu_str += f"  {bleu_ci_str}"
        lines.append(_kv("BLEU (corpus)", bleu_str))
        # spBLEU — BLEU on the FLORES-200 SentencePiece tokenizer, the figure
        # FLORES/NLLB tables report. Every report computes it; the card never
        # showed it (synthetic researcher, Round 7). None = the tokenizer was
        # unavailable when the run was scored (said, never hidden); a report
        # written without the key at all shows no line.
        if "corpus_spbleu" in overall:
            spbleu = overall.get("corpus_spbleu")
            lines.append(_kv("spBLEU (corpus)", f"{spbleu:.1f}"
                             if isinstance(spbleu, (int, float))
                             else "not computed (FLORES-200 tokenizer "
                                  "unavailable when scored)"))

        if ter:
            lines.append(_kv("TER", f"{ter:.1f}"))
        # COMET and MetricX get a row whether or not they were computed: a run
        # without COMET used to show no COMET row at all, so the reader could not
        # tell "not installed" from "not shown" (synthetic researcher, Round 8).
        # The reason is the report's own metric_availability.
        def _neural_row(key: str, metric: str, value: str | None,
                        older: str | None = None) -> None:
            text = value
            if text is None and overall:
                text = availability_value(overall, metric)
                if text is None and "metric_availability" not in overall:
                    text = older   # a report written before the block existed
            if text is None:
                return
            for i, chunk in enumerate(_wrap(text, BOX_W - 4 - 23)):
                lines.append(_kv(key if i == 0 else "", chunk))

        _neural_row("COMET", "comet_score",
                    f"{comet:.3f}" if comet is not None else None,
                    older="not computed (this report predates the reason — "
                          "`mt-eval setup --status` says what is installed)")
        # ↓ = lower is better (MetricX is an error score, 0–25) — never read like COMET.
        _neural_row("MetricX-24 ↓", "metricx_score",
                    f"{metricx:.3f} (lower=better)" if metricx is not None
                    else None)

        # Diagnostics: reported separately, never in the headline.
        lines.append(_kv("Diagnostics", "below — never in the headline"))
        exact_str = f"{exact_n}/{evaluated} ({exact_pct:.1f}%)"
        # Exact match CI is stored as a rate (0.02–0.05), convert to percentage.
        # Same n<2 / zero-width guard as _fmt_ci — no fake 95% interval on a
        # single entry.
        exact_lo = exact_ci.get("ci_lower", exact_ci.get("lower", 0))
        exact_hi = exact_ci.get("ci_upper", exact_ci.get("upper", 0))
        if exact_ci.get("n_entries", 2) >= 2 and exact_lo and exact_hi and exact_hi > exact_lo:
            exact_str += f"  [{exact_lo*100:.1f}% – {exact_hi*100:.1f}%]"
        lines.append(_kv("Exact match", exact_str))

        # The composite is retired (scoring standard/1): only a report from
        # before the standard shows its stored one, as "legacy composite
        # (retired)"; a standard report shows nothing here.
        lines.extend(composite_card_lines(overall,
                                          glossary=report.get("glossary")))

    lines.append(_box_sep())

    # Difficulty tier breakdown
    if by_diff:
        lines.append(_box_line("BY DIFFICULTY TIER"))
        lines.append(_box_line())
        # Header
        hdr = f"{'Tier':<18} {'N':>5}  {'Exact':>7}  {'chrF++*':>7}  {'BLEU*':>6}"
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

        lines.append(_box_line())
        lines.append(_box_line("* mean of per-sentence scores, not the corpus scores"))
        lines.append(_box_line("  above — the two are different statistics."))
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
        for key, value in fst_lines(fst):
            # wrapped: a "not computed: <why + install command>" reason is
            # longer than the value column and used to break the box
            for i, chunk in enumerate(_wrap(value, BOX_W - 4 - 23)):
                lines.append(_kv(key if i == 0 else "", chunk))
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

        # Terminology — the published value WITH the counts it is computed
        # from (matched / total glossary-term occurrences). The card used to
        # print "91.9% adherence" beside 0 of 7 terms matched: term-free
        # entries each counted as 1.0 (Round 3 researcher + hospital).
        from mt_eval_harness.plugins.terminology import adherence_label
        term_label = adherence_label(plugins.get("terminology"))
        if term_label:
            for i, chunk in enumerate(_wrap(term_label, BOX_W - 4 - 23)):
                lines.append(_kv("Terminology" if i == 0 else "", chunk))

        lines.append(_box_sep())

    # Cost & performance
    lines.append(_box_line("COST & PERFORMANCE"))
    lines.append(_box_line())
    lines.append(_kv("Total cost", run_cost_label(run_log, report)))

    # Calculate elapsed display
    if elapsed > 60:
        mins = int(elapsed // 60)
        secs = int(elapsed % 60)
        elapsed_str = f"{mins}m {secs}s ({elapsed:.0f}s)"
    else:
        elapsed_str = f"{elapsed:.1f}s"
    # elapsed_s times the TRANSLATION phase only (the model calls): start-up,
    # model loading and scoring fall outside it, so a 44-second MCP job on an
    # instant local server read "Elapsed 0.0s" (synthetic hospital, Round 6)
    lines.append(_kv("Translation time", f"{elapsed_str} (model calls only)"))
    # Recorded or not, and the precision it needs (latency_reading).
    _lat = latency_reading(report, results, config)
    _lat_text = (f"{latency_text(_lat['avg'])}s/entry" if _lat["recorded"]
                 else f"not recorded — {_lat['why']}")
    for i, chunk in enumerate(_wrap(_lat_text, BOX_W - 4 - 23)):
        lines.append(_kv("Avg latency" if i == 0 else "", chunk))
    lines.append(_kv("Cache hits", f"{cache_hits:,}"))

    # Cost per entry
    if evaluated > 0 and total_cost is not None:
        lines.append(_kv("Cost per entry", f"${total_cost/evaluated:.4f}"))

    lines.append(_box_sep())

    # Provenance
    lines.append(_box_line("PROVENANCE"))
    lines.append(_box_line())
    inner_val_w = BOX_W - 4 - 23  # available chars for value column
    lines.append(_kv("Run ID", run_id[:inner_val_w]))
    lines.append(_kv("Timestamp", timestamp[:inner_val_w]))
    lines.append(_kv("Log file", run_log_path.name[:inner_val_w]))
    # Which report the scores above came from (beside the log, or where
    # `mt-eval test -o` recorded it) — or that none was found.
    lines.append(_kv("Report file", (Path(report_path).name if report
                                     else "none found")[:inner_val_w]))

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
        help="Run log JSON file(s) to render. Each one's report is found "
             "beside it or where `mt-eval test -o` recorded it; a report "
             "file is read with the run log it records.",
    )
    args = parser.parse_args()

    for filepath in args.files:
        path = Path(filepath)
        if not path.exists():
            print(f"  ✗ File not found: {filepath}", file=sys.stderr)
            continue
        try:
            log, report = card_inputs(path)
            print(render_run_card(log, report))
        except ReportPairingError as exc:
            print(f"  ✗ {exc}", file=sys.stderr)


if __name__ == "__main__":
    main()
