#!/usr/bin/env python3
"""Standing integrity linter for MT evaluation run reports.

Validates every harness run pair (run_*.json + run_*_report.json) in
arena/eval/logs/harness/ BEFORE its scores are treated as canonical or
published to the leaderboard. Read-only — never modifies reports, never
touches Supabase.

WHAT IT CHECKS (finding ids in brackets; severity in parentheses):

  Structural integrity
    [schema]      (ERROR) required blocks missing from run log or report
    [pair]        (ERROR) run log <-> report mismatches: run_id, config
                          hash, entry ids/order, predicted text drift,
                          run_id vs filename, orphaned halves
  Score sanity
    [score-range] (ERROR) per-entry chrF/BLEU outside 0-100, rates outside
                          0-1, negative latency/cost, malformed CI bounds
                          (lower > score or score > upper), plugin
                          aggregates outside their scales
    [counts]      (ERROR) entry-count arithmetic: total != evaluated +
                          errors, exact + miss != evaluated, by_segment /
                          by_difficulty / by_domain sums != total,
                          duplicate entry ids, entries[] length != total
    [aggregates]  (ERROR) recomputed aggregates disagree with reported
                          ones. Mirrors tester.py semantics: averages over
                          NON-ERROR entries only — also catches the
                          zero-contamination failure where errored entries
                          (which carry chrf_score=0.0, not null) leak into
                          corpus averages
    [vacuous]     (ERROR) evaluated == 0: every rate in the report is a
                          vacuous 0.0 computed over nothing; never
                          publishable
    [null-handling] (ERROR) metric-null contract violations: terminology
                          average inconsistent with its match counts,
                          non-error entries with null core metrics
                  (WARN)  corpus_chrf absent with evaluated > 0 (composite
                          would silently renormalize away its top surface
                          signal), comet outside ~0-1
  Corpus identity (vs arena/datasets/registry.json)
    [corpus-eligibility] (ERROR) run executed against a quarantined or
                          local-only (sealed-overlap) corpus — score-
                          invalidating per arena/datasets/DATA_INTEGRITY.md
    [corpus-identity]    (ERROR) provenance.corpus_sha256 disagrees with
                          the registry-declared sha256, with the resolved
                          local corpus file, or with other runs of the
                          same dataset (corpus changed under the runs);
                          entry count exceeds registry size
    [registry]    (WARN)  corpus not resolvable in the registry (publishes
                          without license metadata), or entry count !=
                          registry size (subset / filtered run)
  Labels and comparability
    [condition]   (WARN)  condition label outside the known vocabulary
                          {naive, coached, champollion}; 'naive' label on a
                          run whose provenance shows a coaching prompt or
                          champollion config (publish.py relabels these at
                          card-assembly time — the report label misstates
                          the experiment)
    [condition-drift] (WARN) the same (dataset, condition) pair appears
                          under multiple system_prompt_sha256 values —
                          one label covering different prompts
    [model-frag]  (WARN)  the same _model_id appears under multiple model
                          slugs (fragments the leaderboard, which groups
                          by model_slug)
    [partial]     (WARN)  error_count > 0: corpus-level scores cover only
                          the surviving subset and are not comparable to
                          full-corpus runs
    [small-corpus] (WARN) evaluated < 100: below the significance floor of
                          the corpus-design spec (§6.3) — no cross-method
                          significance claims; < 50: below the development-
                          set floor
  Reproducibility
    [fingerprint] (INFO)  groups of runs sharing an identical publish
                          fingerprint (BENCHMARK_SPEC §3.8 recipe:
                          dataset sha + model slug + condition + prompt
                          sha + temperature + batch size + tools +
                          harness version). Duplicates upsert to ONE card.

  Card mode (--assemble, or --cards FILE...): assembles run cards via the
  harness's own mt_eval_harness.publish.assemble_run_card (offline, no
  Supabase) — or reads pre-exported card JSONs — and validates:
    [card]        (ERROR) fingerprint.hash != sha256 of its own sorted
                          components, components disagree with card
                          fields, run_card_hash tamper seal broken,
                          composite != re-normalized weighted average per
                          scoring.py (SCORING_SPEC §4.1-4.3), quality_tier
                          != classify_quality_tier(composite), composite
                          outside 0-1

Usage:
    python3 arena/scripts/lint_run_reports.py                 # lint eval/logs/harness
    python3 arena/scripts/lint_run_reports.py --strict        # warnings also fail
    python3 arena/scripts/lint_run_reports.py --assemble      # + run-card checks
    python3 arena/scripts/lint_run_reports.py --json > lint.json
    python3 arena/scripts/lint_run_reports.py path/to/run_X_report.json ...

Exit codes:
    0  no errors (warnings allowed unless --strict)
    1  errors found (CI should fail; scores must not be canonicalized)
    2  linter could not run (no reports found, registry missing, etc.)

@see docs/TATOEBA_FAIR_SCORING_POLICY.md for the scoring policy this gates
@see cli/website/docs/network/specifications/scoring.md (metric scales, composite)
@see cli/website/docs/network/specifications/benchmark-spec.md §3.8 (fingerprint)
@see cli/scripts/audit-fact-provenance.mjs for the sibling CLI-side audit
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

ARENA_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_REPORTS_DIR = ARENA_ROOT / "eval" / "logs" / "harness"
DEFAULT_REGISTRY = ARENA_ROOT / "datasets" / "registry.json"

# Float tolerances sized to the rounding tester.py applies when writing
# reports (avg_* rounded to 2dp, rates to 4dp, latency 3dp, cost 4dp).
TOL_RATE = 0.00006      # 4dp rounding half-step + epsilon
TOL_AVG = 0.006         # 2dp rounding half-step + epsilon
TOL_LATENCY = 0.0006
TOL_COST = 0.00006
EPS = 1e-6              # sacrebleu emits e.g. 100.00000000000004

# Condition labels minted by the harness CLI (mt_eval_harness/cli.py):
# 'naive' default, 'coached' when a coaching file is supplied,
# 'champollion' when a champollion config drives the run. Method cards can
# extend this at publish time, so unknown labels WARN rather than fail.
KNOWN_CONDITIONS = {"naive", "coached", "champollion"}

# Significance floors from the corpus design spec
# (cli/website/docs/network/specifications/corpus-design.md §6.3).
SIGNIFICANCE_FLOOR = 100   # below: no cross-method significance claims
DEV_SET_FLOOR = 50         # below: diagnostic only


class Findings:
    """Collects findings and renders the summary / JSON output."""

    SEVERITIES = ("ERROR", "WARN", "INFO")

    def __init__(self) -> None:
        self.items: list[dict] = []

    def add(self, check: str, severity: str, scope: str, message: str) -> None:
        self.items.append(
            {"check": check, "severity": severity, "scope": scope, "message": message}
        )

    def count(self, severity: str) -> int:
        return sum(1 for f in self.items if f["severity"] == severity)

    def by_check(self) -> dict[str, list[dict]]:
        grouped: dict[str, list[dict]] = defaultdict(list)
        for f in self.items:
            grouped[f["check"]].append(f)
        return grouped


# ---------------------------------------------------------------------------
# Registry resolution
# ---------------------------------------------------------------------------

def load_registry(registry_path: Path) -> list[dict]:
    data = json.loads(registry_path.read_text(encoding="utf-8"))
    return data.get("datasets", [])


def resolve_by_id(config: dict, registry: list[dict]) -> dict | None:
    """Resolve the dataset the run DECLARES (config.dataset_id / dataset)."""
    wanted_ids = {
        str(config.get("dataset_id") or "").strip(),
        str(config.get("dataset") or "").strip(),
    } - {"", "all"}
    for d in registry:
        ids = {d.get("id")} | set(d.get("aliases") or [])
        if wanted_ids & ids:
            return d
    return None


def resolve_by_path(config: dict, registry: list[dict]) -> dict | None:
    """Resolve the dataset the run was ACTUALLY fed (config.corpus_path).

    Reports record corpus_path as written on the run machine — absolute,
    relative, or pointing at a directory that no longer exists — so
    resolution is by path suffix against the registry's `path` (relative to
    arena/datasets/) and `local_path` (relative to arena/), with a unique-
    basename fallback.

    Quarantined / local-only datasets are deliberately untracked, so they
    carry no path fields — for those, the corpus basename is matched
    against the entry's name/notes so ineligible runs cannot slip through
    as merely "unregistered".
    """
    corpus_path = (config.get("corpus_path") or "").replace("\\", "/")
    if not corpus_path:
        return None

    norm = corpus_path.lstrip("./")
    for d in registry:
        for key in ("path", "local_path"):
            rel = (d.get(key) or "").lstrip("./")
            if not rel:
                continue
            if norm == rel or norm.endswith("/" + rel):
                return d
            # registry `path` is relative to arena/datasets/
            if key == "path" and norm.endswith("/datasets/" + rel):
                return d

    base = norm.rsplit("/", 1)[-1]
    for d in registry:
        restricted = d.get("quarantine") or (d.get("access") or "").lower() in (
            "quarantined", "local-only")
        if restricted and base and (
                base in (d.get("name") or "") or base in (d.get("notes") or "")):
            return d

    matches = [
        d for d in registry
        if any((d.get(k) or "").rsplit("/", 1)[-1] == base for k in ("path", "local_path"))
    ]
    return matches[0] if len(matches) == 1 else None


def resolve_corpus_file(config: dict, entry: dict | None) -> Path | None:
    """Best-effort local path for the corpus file, for sha verification."""
    candidates = []
    corpus_path = config.get("corpus_path") or ""
    if corpus_path:
        candidates.append(Path(corpus_path))
        candidates.append(ARENA_ROOT / corpus_path)
    if entry:
        if entry.get("path"):
            candidates.append(ARENA_ROOT / "datasets" / entry["path"])
        if entry.get("local_path"):
            candidates.append(ARENA_ROOT / entry["local_path"])
    for cand in candidates:
        try:
            if cand.is_file():
                return cand
        except OSError:
            continue
    return None


# ---------------------------------------------------------------------------
# Per-pair checks
# ---------------------------------------------------------------------------

def _num(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def check_pair(stem: str, run: dict | None, report: dict | None, f: Findings) -> bool:
    """Validate the run log <-> report pairing. Returns True when the pair
    is trustworthy; False when the two halves are not from the same run
    (e.g. a log-filename collision between concurrent sweep workers), so
    downstream checks don't attribute one run's provenance to another's
    scores."""
    if report is None:
        f.add("pair", "ERROR", stem, "run log present but report missing — run is unscored")
        return False
    if run is None:
        f.add("pair", "ERROR", stem,
              "report present but run log missing — provenance (prompt/corpus sha) unverifiable")
        return False

    for name, doc, keys in (
        ("report", report, ("run_id", "config", "overall", "entries")),
        ("run log", run, ("run_id", "config", "provenance", "results")),
    ):
        missing = [k for k in keys if k not in doc]
        if missing:
            f.add("schema", "ERROR", stem, f"{name} missing required keys: {', '.join(missing)}")

    ok = True
    rid_run, rid_rep = run.get("run_id"), report.get("run_id")
    if rid_run != rid_rep:
        f.add("pair", "ERROR", stem, f"run_id mismatch: run log {rid_run!r} vs report {rid_rep!r}")
        ok = False
    if rid_rep and rid_rep != stem:
        f.add("pair", "ERROR", stem, f"report run_id {rid_rep!r} != filename stem")

    h_run = (run.get("config") or {}).get("_config_hash")
    h_rep = (report.get("config") or {}).get("_config_hash")
    if h_run != h_rep:
        f.add("pair", "ERROR", stem,
              f"config hash mismatch: {h_run!r} vs {h_rep!r} — the report and run log are "
              "from DIFFERENT runs (log-filename collision between concurrent sweep "
              "starts?); neither half is publishable")
        ok = False

    results = run.get("results") or []
    entries = report.get("entries") or []
    ids_run = [e.get("id") for e in results]
    ids_rep = [e.get("id") for e in entries]
    if ids_run != ids_rep:
        f.add("pair", "ERROR", stem,
              f"entry id sequences differ (run log {len(ids_run)}, report {len(ids_rep)})")
        ok = False
    else:
        drift = [
            e.get("id") for e, r in zip(entries, results)
            if e.get("predicted") != r.get("predicted") or e.get("expected") != r.get("expected")
        ]
        if drift:
            f.add("pair", "ERROR", stem,
                  f"{len(drift)} entries with predicted/expected text drift between run log "
                  f"and report (e.g. {drift[:3]})")
            ok = False
    return ok


def check_report(stem: str, report: dict, f: Findings) -> None:
    overall = report.get("overall") or {}
    entries = report.get("entries") or []

    total = overall.get("total_entries")
    evaluated = overall.get("evaluated")
    errors = overall.get("error_count", 0)

    # --- counts -----------------------------------------------------------
    if _num(total) and len(entries) != total:
        f.add("counts", "ERROR", stem,
              f"entries[] has {len(entries)} items but total_entries={total}")
    if _num(total) and _num(evaluated) and evaluated + errors != total:
        f.add("counts", "ERROR", stem,
              f"evaluated ({evaluated}) + error_count ({errors}) != total_entries ({total})")

    exact = overall.get("exact_match_count")
    miss = overall.get("miss_count")
    if _num(exact) and _num(miss) and _num(evaluated) and exact + miss != evaluated:
        f.add("counts", "ERROR", stem,
              f"exact_match_count ({exact}) + miss_count ({miss}) != evaluated ({evaluated})")

    ids = [e.get("id") for e in entries]
    if len(ids) != len(set(ids)):
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        f.add("counts", "ERROR", stem, f"duplicate entry ids: {dupes[:5]}")

    for block_name in ("by_segment", "by_difficulty", "by_domain"):
        block = report.get(block_name) or {}
        if not block:
            continue
        block_total = sum(g.get("count", 0) for g in block.values())
        if _num(total) and block_total != total:
            f.add("counts", "ERROR", stem,
                  f"{block_name} counts sum to {block_total}, expected {total}")
        for key, g in block.items():
            parts = (g.get("exact_match_count", 0) + g.get("miss_count", 0)
                     + g.get("error_count", 0))
            if parts != g.get("count", 0):
                f.add("counts", "ERROR", stem,
                      f"{block_name}[{key!r}]: exact+miss+error ({parts}) != count ({g.get('count')})")

    # --- vacuous / partial --------------------------------------------------
    if evaluated == 0:
        f.add("vacuous", "ERROR", stem,
              f"evaluated=0 ({errors}/{total} entries errored) — every rate in this report "
              "is a vacuous 0.0; must never be published or compared")
        return  # aggregate recomputation is meaningless past this point
    if errors:
        f.add("partial", "WARN", stem,
              f"{errors}/{total} entries errored — corpus-level scores cover only the "
              "surviving subset and are not comparable to full-corpus runs")

    # --- per-entry score ranges ---------------------------------------------
    bad_range, null_core = [], []
    n_errors_recount, n_exact_recount = 0, 0
    chrf_sum, chrf_n, bleu_sum, bleu_n = 0.0, 0, 0.0, 0
    for e in entries:
        eid = e.get("id")
        if e.get("error"):
            n_errors_recount += 1
            continue
        chrf, bleu = e.get("chrf_score"), e.get("bleu_score")
        for name, val, hi in (("chrf_score", chrf, 100), ("bleu_score", bleu, 100)):
            if val is None:
                null_core.append((eid, name))
            elif not _num(val) or not (-EPS <= val <= hi + EPS):
                bad_range.append((eid, name, val))
        for name, val in (("latency_s", e.get("latency_s")), ("cost_usd", e.get("cost_usd"))):
            if val is not None and _num(val) and val < 0:
                bad_range.append((eid, name, val))
        if e.get("exact_match") is True:
            n_exact_recount += 1
        if _num(chrf):
            chrf_sum += chrf
            chrf_n += 1
        if _num(bleu):
            bleu_sum += bleu
            bleu_n += 1

    if bad_range:
        f.add("score-range", "ERROR", stem,
              f"{len(bad_range)} per-entry values out of range, e.g. "
              + "; ".join(f"{i}:{n}={v}" for i, n, v in bad_range[:3]))
    if null_core:
        f.add("null-handling", "ERROR", stem,
              f"{len(null_core)} non-error entries with null core metrics, e.g. "
              + "; ".join(f"{i}:{n}" for i, n in null_core[:3]))

    # --- aggregate recomputation (tester.py semantics: non-error only) -------
    if n_errors_recount != errors:
        f.add("counts", "ERROR", stem,
              f"entries with error set: {n_errors_recount}, but overall.error_count={errors}")
    if _num(exact) and n_exact_recount != exact:
        f.add("aggregates", "ERROR", stem,
              f"recounted exact matches {n_exact_recount} != exact_match_count {exact}")
    rate = overall.get("exact_match_rate")
    if _num(rate) and _num(evaluated) and evaluated:
        if abs(rate - n_exact_recount / evaluated) > TOL_RATE:
            f.add("aggregates", "ERROR", stem,
                  f"exact_match_rate {rate} != recomputed "
                  f"{n_exact_recount / evaluated:.4f}")
    for name, sum_, n_, tol in (("avg_chrf", chrf_sum, chrf_n, TOL_AVG),
                                ("avg_bleu", bleu_sum, bleu_n, TOL_AVG)):
        reported = overall.get(name)
        if _num(reported) and n_:
            recomputed = sum_ / n_
            if abs(reported - recomputed) > tol:
                f.add("aggregates", "ERROR", stem,
                      f"{name} {reported} != recomputed {recomputed:.2f} over {n_} "
                      "non-error entries (errored entries leaking into the average?)")

    # --- overall ranges -------------------------------------------------------
    for name, lo, hi in (("exact_match_rate", 0, 1), ("miss_rate", 0, 1),
                         ("avg_chrf", 0, 100), ("avg_bleu", 0, 100),
                         ("corpus_chrf", 0, 100), ("corpus_bleu", 0, 100),
                         ("corpus_ter", 0, None)):
        val = overall.get(name)
        if val is None:
            continue
        if not _num(val) or val < lo - EPS or (hi is not None and val > hi + EPS):
            f.add("score-range", "ERROR", stem, f"overall.{name}={val!r} outside [{lo}, {hi}]")

    if overall.get("corpus_chrf") is None:
        f.add("null-handling", "WARN", stem,
              "corpus_chrf absent with evaluated > 0 — the published composite would "
              "silently renormalize away its primary surface signal")

    comet = overall.get("comet_score")
    if comet is not None and _num(comet) and not (0 - EPS <= comet <= 1 + EPS):
        f.add("null-handling", "WARN", stem,
              f"comet_score={comet} outside the ~0-1 scale documented in SCORING_SPEC §2.3")

    # --- confidence intervals ---------------------------------------------------
    ci_ranges = {"corpus_chrf": 100, "corpus_bleu": 100,
                 "exact_match_rate": 1, "composite_score": 1}
    for name, ci in (overall.get("confidence_intervals") or {}).items():
        if not isinstance(ci, dict):
            continue
        score, lo, hi = ci.get("score"), ci.get("ci_lower"), ci.get("ci_upper")
        if not all(_num(v) for v in (score, lo, hi)):
            continue
        if not (lo - EPS <= score <= hi + EPS):
            f.add("score-range", "ERROR", stem,
                  f"CI[{name}]: score {score} outside its own interval [{lo}, {hi}]")
        cap = ci_ranges.get(name)
        if cap is not None and not (-EPS <= lo and hi <= cap + EPS):
            f.add("score-range", "ERROR", stem,
                  f"CI[{name}]: bounds [{lo}, {hi}] outside metric scale [0, {cap}]")

    # --- plugin aggregate scales + terminology null contract ----------------------
    plug = overall.get("plugin_metrics") or {}
    plugin_unit_fields = {
        "giellalt_fst_validity": ("avg_fst_validity", "corpus_validity_rate"),
        "code_switching": ("avg_code_switching_rate",),
        "hallucination": ("avg_hallucination_rate", "max_hallucination_rate"),
        "terminology": ("avg_terminology_adherence",),
    }
    for plugin, fields in plugin_unit_fields.items():
        data = plug.get(plugin) or {}
        for field in fields:
            val = data.get(field)
            if val is not None and _num(val) and not (0 - EPS <= val <= 1 + EPS):
                f.add("score-range", "ERROR", stem,
                      f"plugin_metrics.{plugin}.{field}={val} outside [0, 1]")
    fst = plug.get("giellalt_fst_validity") or {}
    if _num(fst.get("total_valid_words")) and _num(fst.get("total_words_checked")):
        if fst["total_valid_words"] > fst["total_words_checked"]:
            f.add("counts", "ERROR", stem,
                  "FST plugin: total_valid_words > total_words_checked")
    term = plug.get("terminology") or {}
    if "avg_terminology_adherence" in term:
        avg, total_terms = term.get("avg_terminology_adherence"), term.get("total_term_total")
        if avg is None and _num(total_terms) and total_terms > 0:
            f.add("null-handling", "ERROR", stem,
                  f"terminology adherence is null but {total_terms} terms were checked")
        if avg is not None and _num(total_terms) and total_terms == 0:
            f.add("null-handling", "ERROR", stem,
                  f"terminology adherence={avg} reported with zero terms checked "
                  "(null-coerced-to-score)")

def check_corpus_identity(stem: str, run: dict, report: dict,
                          registry: list[dict], f: Findings, pair_ok: bool,
                          sha_by_dataset: dict, file_sha_cache: dict,
                          unregistered: dict, ineligible: set) -> str | None:
    """Registry resolution, eligibility, sha verification. Returns dataset id.

    When pair_ok is False the run log belongs to a different run, so its
    provenance (corpus sha) must not be attributed to this report's
    dataset — only the report-side registry/eligibility checks run.
    """
    config = report.get("config") or {}
    provenance = (run or {}).get("provenance") or {}
    corpus_path = config.get("corpus_path") or "(none)"

    declared = resolve_by_id(config, registry)
    actual = resolve_by_path(config, registry)
    if declared and actual and declared.get("id") != actual.get("id"):
        f.add("corpus-identity", "ERROR", stem,
              f"declared dataset_id '{declared.get('id')}' but corpus_path resolves to "
              f"'{actual.get('id')}' — the card would attribute scores to a dataset the "
              "run never executed against")
    # The file actually fed to the model is ground truth for eligibility,
    # sha pinning, and size checks; the declared id only labels the card.
    entry = actual or declared

    if entry is None:
        unregistered.setdefault(corpus_path, []).append(stem)
        dataset_key = corpus_path
    else:
        dataset_key = entry.get("id", corpus_path)
        access = (entry.get("access") or "").lower()
        if entry.get("quarantine") or access == "quarantined":
            f.add("corpus-eligibility", "ERROR", stem,
                  f"run executed against QUARANTINED dataset '{entry.get('id')}' — "
                  "score-invalidating; see arena/datasets/DATA_INTEGRITY.md")
            ineligible.add(dataset_key)
        elif access == "local-only":
            f.add("corpus-eligibility", "ERROR", stem,
                  f"run executed against local-only dataset '{entry.get('id')}' "
                  "(re-exposes sealed segments) — must not be published or treated as "
                  "held-out evaluation; see arena/datasets/DATA_INTEGRITY.md")
            ineligible.add(dataset_key)

        size = entry.get("size")
        total = (report.get("overall") or {}).get("total_entries")
        if _num(size) and _num(total) and config.get("entry_ids") is None:
            if total > size:
                f.add("corpus-identity", "ERROR", stem,
                      f"report has {total} entries but registry size for "
                      f"'{entry.get('id')}' is {size} — more entries than the corpus holds")
            elif total != size:
                f.add("registry", "WARN", stem,
                      f"report has {total} entries; registry size for "
                      f"'{entry.get('id')}' is {size} (subset or filtered run?)")

    if not pair_ok:
        return dataset_key

    sha = provenance.get("corpus_sha256") or ""
    if not sha:
        f.add("corpus-identity", "WARN", stem,
              "provenance.corpus_sha256 is empty — run is not pinned to a corpus version")
        return dataset_key

    if entry and entry.get("sha256") and sha != entry["sha256"]:
        f.add("corpus-identity", "ERROR", stem,
              f"corpus_sha256 {sha[:12]}… != registry sha256 {entry['sha256'][:12]}… for "
              f"'{entry.get('id')}' — run used an unregistered corpus version (content "
              "change, or a different serialization of the same entries, e.g. path vs "
              "local_path file); update the registry pin or re-run on the pinned version")

    local = resolve_corpus_file(config, entry)
    if local is not None:
        key = str(local)
        if key not in file_sha_cache:
            file_sha_cache[key] = hashlib.sha256(local.read_bytes()).hexdigest()
        if file_sha_cache[key] != sha:
            f.add("corpus-identity", "ERROR", stem,
                  f"corpus_sha256 {sha[:12]}… != sha256 of {local} "
                  f"({file_sha_cache[key][:12]}…) — corpus file changed since the run; "
                  "scores are pinned to bytes that no longer exist locally")

    sha_by_dataset[dataset_key].add(sha)
    return dataset_key


# ---------------------------------------------------------------------------
# Cross-run checks
# ---------------------------------------------------------------------------

def derive_condition(config: dict, provenance: dict) -> str:
    """Mirror publish.py's condition derivation (the published label)."""
    condition = config.get("prompt_version", "")
    if condition == "naive" and provenance.get("coaching_prompt"):
        condition = "coached"
    return condition


def compute_fingerprint(run: dict) -> str:
    """Recompute the publish fingerprint per BENCHMARK_SPEC §3.8.

    Independent re-derivation of the recipe implemented by
    mt_eval_harness/publish.py (assemble_run_card). Parity between the two
    is pinned by tests/test_lint_run_reports.py so drift in either is
    caught.
    """
    config = run.get("config") or {}
    provenance = run.get("provenance") or {}
    components = {
        "dataset_sha256": provenance.get("corpus_sha256", ""),
        "model_slug": config.get("model", ""),
        "condition": derive_condition(config, provenance),
        "system_prompt_sha256": provenance.get("system_prompt_sha256", ""),
        "temperature": config.get("_effective_temperature", config.get("temperature", 0)),
        "batch_size": config.get("batch_size", 25),
        "tools_enabled": config.get("tools_enabled", False),
        "harness_version": run.get("harness_version", ""),
    }
    payload = json.dumps(components, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()


def check_conditions_and_models(pairs: dict, dataset_of: dict,
                                corrupted: set, f: Findings) -> None:
    prompt_by_label = defaultdict(set)     # (dataset, condition) -> prompt shas
    slugs_by_model_id = defaultdict(set)   # _model_id -> config.model slugs
    for stem, (run, report) in pairs.items():
        if run is None or report is None or stem in corrupted:
            continue
        config = report.get("config") or {}
        provenance = run.get("provenance") or {}
        condition = derive_condition(config, provenance)

        if condition == "" :
            f.add("condition", "WARN", stem,
                  "condition label is empty — run would publish unlabeled")
        elif condition not in KNOWN_CONDITIONS and not any(
                condition.startswith(k + "-") for k in KNOWN_CONDITIONS):
            f.add("condition", "WARN", stem,
                  f"condition {condition!r} outside known vocabulary "
                  f"{sorted(KNOWN_CONDITIONS)} — verify it is a sanctioned method-card class")

        if config.get("prompt_version") == "naive":
            if provenance.get("coaching_prompt"):
                f.add("condition", "WARN", stem,
                      "labelled 'naive' but provenance carries a coaching prompt — "
                      "publish.py will relabel this run 'coached'; the report/filename "
                      "label misstates the experiment")
            if config.get("champollion_config_path"):
                f.add("condition", "WARN", stem,
                      "labelled 'naive' but a champollion config drove the run — "
                      "should be condition 'champollion'")

        prompt_sha = provenance.get("system_prompt_sha256", "")
        dataset = dataset_of.get(stem)
        if prompt_sha and dataset:
            prompt_by_label[(dataset, condition)].add(prompt_sha)

        model_id = config.get("_model_id") or ""
        slug = config.get("model") or ""
        if model_id and slug:
            slugs_by_model_id[model_id].add(slug)

    for (dataset, condition), shas in sorted(prompt_by_label.items()):
        if len(shas) > 1:
            f.add("condition-drift", "WARN", f"{dataset} / {condition}",
                  f"{len(shas)} distinct system prompts published under one condition "
                  f"label: {sorted(s[:12] for s in shas)}")

    for model_id, slugs in sorted(slugs_by_model_id.items()):
        if len(slugs) > 1:
            f.add("model-frag", "WARN", model_id,
                  f"one model id appears under {len(slugs)} model slugs {sorted(slugs)} — "
                  "leaderboard groups by slug, so these runs will not aggregate")


def check_fingerprints(pairs: dict, corrupted: set, f: Findings) -> dict[str, str]:
    fingerprints: dict[str, str] = {}
    groups = defaultdict(list)
    for stem, (run, report) in sorted(pairs.items()):
        if run is None or stem in corrupted:
            continue
        fp = compute_fingerprint(run)
        fingerprints[stem] = fp
        groups[fp].append(stem)
    duplicate_groups = {fp: stems for fp, stems in groups.items() if len(stems) > 1}
    for fp, stems in sorted(duplicate_groups.items()):
        f.add("fingerprint", "INFO", fp[:12],
              f"{len(stems)} runs share one experimental fingerprint (re-runs); they "
              f"upsert to a single leaderboard card: {stems[:4]}"
              + ("…" if len(stems) > 4 else ""))
    return fingerprints


# ---------------------------------------------------------------------------
# Run-card checks (--assemble / --cards)
# ---------------------------------------------------------------------------

def _harness_imports():
    sys.path.insert(0, str(ARENA_ROOT))
    from mt_eval_harness.scoring import (        # noqa: PLC0415
        classify_quality_tier, compute_composite_score,
    )
    return compute_composite_score, classify_quality_tier


COMPOSITE_FIELDS = (
    "exact_match_rate", "equivalent_match_rate", "fst_acceptance_rate",
    "chrf_plus_plus", "semantic_score", "code_switching_rate",
    "hallucination_rate", "terminology_adherence", "morphological_accuracy",
)


def check_card(scope: str, card: dict, f: Findings,
               compute_composite_score, classify_quality_tier) -> None:
    fp = card.get("fingerprint") or {}
    components, declared = fp.get("components"), fp.get("hash")
    if not components or not declared:
        f.add("card", "ERROR", scope, "fingerprint block missing hash or components")
    else:
        recomputed = hashlib.sha256(
            json.dumps(components, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest()
        if recomputed != declared:
            f.add("card", "ERROR", scope,
                  f"fingerprint.hash {declared[:12]}… != sha256 of its own components "
                  f"{recomputed[:12]}…")
        component_sources = {
            "dataset_sha256": (card.get("dataset") or {}).get("sha256"),
            "model_slug": card.get("model_slug"),
            "condition": card.get("condition"),
            "system_prompt_sha256": card.get("system_prompt_sha256"),
            "temperature": card.get("temperature"),
            "batch_size": card.get("batch_size"),
            "tools_enabled": card.get("tools_enabled"),
            "harness_version": card.get("harness_version"),
        }
        for key, expected in component_sources.items():
            if key in components and components[key] != expected:
                f.add("card", "ERROR", scope,
                      f"fingerprint component {key}={components[key]!r} disagrees with "
                      f"card field {expected!r}")

    declared_card_hash = card.get("run_card_hash")
    if declared_card_hash:
        clone = json.loads(json.dumps(card))
        clone["run_card_hash"] = ""
        recomputed = hashlib.sha256(
            json.dumps(clone, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest()
        if recomputed != declared_card_hash:
            f.add("card", "ERROR", scope,
                  "run_card_hash tamper seal does not verify against card contents")

    scores = card.get("scores") or {}
    composite = scores.get("composite")
    if composite is not None:
        if not (0 - EPS <= composite <= 1 + EPS):
            f.add("card", "ERROR", scope, f"composite={composite} outside [0, 1]")
        inputs = {k: scores.get(k) for k in COMPOSITE_FIELDS}
        # Recompute under the profile the card RECORDS (scores.scoring_profile,
        # SCORING_SPEC §4.3). Re-guessing from FST presence would apply the
        # wrong weight table to no-reference runs and false-flag (or silently
        # pass) their composites. Cards predating the field fall back to the
        # legacy has_fst selection.
        profile = scores.get("scoring_profile")
        has_fst = scores.get("fst_acceptance_rate") is not None
        if isinstance(profile, str) and profile:
            try:
                expected = compute_composite_score(inputs, profile=profile)
            except ValueError as exc:
                # An unknown recorded profile is a card defect — flag, don't crash.
                f.add("card", "ERROR", scope, str(exc))
                expected = None
        else:
            expected = compute_composite_score(inputs, has_fst=has_fst)
        if expected is not None and abs(composite - expected) > 5e-4:
            f.add("card", "ERROR", scope,
                  f"composite {composite} != {expected:.4f} re-normalized over non-null "
                  f"metrics (SCORING_SPEC §4.1, profile "
                  f"{profile if isinstance(profile, str) and profile else ('A' if has_fst else 'B')})")
        tier = classify_quality_tier(composite)
        if scores.get("quality_tier") not in (None, tier):
            f.add("card", "ERROR", scope,
                  f"quality_tier {scores.get('quality_tier')!r} != {tier!r} for "
                  f"composite {composite}")

    total = scores.get("total")
    entry_count = (card.get("dataset") or {}).get("entry_count")
    if _num(total) and _num(entry_count) and total != entry_count:
        f.add("card", "ERROR", scope,
              f"scores.total ({total}) != dataset.entry_count ({entry_count})")
    if card.get("condition") is None:
        f.add("card", "ERROR", scope, "condition is None (NOT NULL on the leaderboard)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def collect_pairs(paths: list[Path], f: Findings) -> dict[str, tuple[dict | None, dict | None]]:
    """Map run stem -> (run log, report), parsing JSON defensively."""
    report_files: dict[str, Path] = {}
    run_files: dict[str, Path] = {}
    for path in paths:
        candidates = (
            sorted(path.glob("run_*.json")) if path.is_dir() else [path]
        )
        for cand in candidates:
            name = cand.name
            if not name.startswith("run_") or not name.endswith(".json"):
                continue
            if name.endswith("_report.json"):
                report_files[name[:-len("_report.json")]] = cand
            else:
                run_files[name[:-len(".json")]] = cand

    # A file argument names one half of a pair; pull its sibling from the
    # same directory so pair checks aren't vacuous false alarms.
    for stem, file in list(report_files.items()):
        sibling = file.parent / f"{stem}.json"
        if stem not in run_files and sibling.is_file():
            run_files[stem] = sibling
    for stem, file in list(run_files.items()):
        sibling = file.parent / f"{stem}_report.json"
        if stem not in report_files and sibling.is_file():
            report_files[stem] = sibling

    pairs: dict[str, tuple[dict | None, dict | None]] = {}
    for stem in sorted(set(report_files) | set(run_files)):
        run = report = None
        for label, source, slot in (("run log", run_files, 0), ("report", report_files, 1)):
            file = source.get(stem)
            if file is None:
                continue
            try:
                doc = json.loads(file.read_text(encoding="utf-8"))
            except (OSError, ValueError, UnicodeDecodeError) as exc:
                f.add("schema", "ERROR", stem, f"{label} unreadable: {exc}")
                doc = None
            if slot == 0:
                run = doc
            else:
                report = doc
        pairs[stem] = (run, report)
    return pairs


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Lint MT evaluation run reports before scores are canonicalized."
    )
    parser.add_argument("paths", nargs="*", type=Path,
                        help=f"report files or directories (default: {DEFAULT_REPORTS_DIR})")
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY,
                        help="corpus registry JSON (default: arena/datasets/registry.json)")
    parser.add_argument("--strict", action="store_true",
                        help="warnings also produce a non-zero exit")
    parser.add_argument("--json", action="store_true", dest="json_out",
                        help="machine-readable findings on stdout")
    parser.add_argument("--assemble", action="store_true",
                        help="assemble run cards via mt_eval_harness.publish (offline) "
                             "and validate composite/fingerprint/tamper seal")
    parser.add_argument("--cards", nargs="*", type=Path, default=None,
                        help="pre-exported run card JSON files to validate")
    args = parser.parse_args()

    findings = Findings()

    if not args.registry.is_file():
        print(f"ERROR: corpus registry not found at {args.registry}", file=sys.stderr)
        return 2
    registry = load_registry(args.registry)

    paths = args.paths or [DEFAULT_REPORTS_DIR]
    missing = [p for p in paths if not p.exists()]
    if missing:
        print(f"ERROR: path(s) not found: {', '.join(map(str, missing))}", file=sys.stderr)
        return 2

    pairs = collect_pairs(paths, findings)
    if not pairs and not args.cards:
        print("ERROR: no run_*.json / run_*_report.json files found", file=sys.stderr)
        return 2

    sha_by_dataset: dict[str, set] = defaultdict(set)
    file_sha_cache: dict[str, str] = {}
    dataset_of: dict[str, str] = {}
    evaluated_of: dict[str, int] = {}
    unregistered: dict[str, list[str]] = {}
    corrupted: set[str] = set()
    ineligible: set[str] = set()
    for stem, (run, report) in pairs.items():
        pair_ok = check_pair(stem, run, report, findings)
        if not pair_ok:
            corrupted.add(stem)
        if report is not None:
            check_report(stem, report, findings)
            dataset = check_corpus_identity(
                stem, run or {}, report, registry, findings, pair_ok,
                sha_by_dataset, file_sha_cache, unregistered, ineligible,
            )
            if dataset:
                dataset_of[stem] = dataset
            evaluated = (report.get("overall") or {}).get("evaluated")
            if _num(evaluated):
                evaluated_of[stem] = evaluated

    for corpus_path, stems in sorted(unregistered.items()):
        findings.add("registry", "WARN", corpus_path,
                     f"{len(stems)} run(s) on a corpus missing from "
                     f"arena/datasets/registry.json — would publish without "
                     f"license/attribution metadata (e.g. {stems[0]})")

    for dataset, shas in sorted(sha_by_dataset.items()):
        real = {s for s in shas if s}
        if len(real) > 1:
            findings.add("corpus-identity", "ERROR", dataset,
                         f"{len(real)} distinct corpus_sha256 values across runs of one "
                         f"dataset — content or serialization changed under the runs; "
                         f"fingerprints diverge, so identical experiments will NOT dedupe "
                         f"to one card and scores are not byte-comparable: "
                         f"{sorted(s[:12] for s in real)}")

    # Corpus size floors (corpus-design §6.3), one finding per dataset.
    largest_run: dict[str, int] = {}
    runs_per_dataset: dict[str, int] = defaultdict(int)
    for stem, dataset in dataset_of.items():
        if dataset in ineligible:
            continue  # already an ERROR; size caveats are moot
        if stem in evaluated_of and evaluated_of[stem] > 0:
            largest_run[dataset] = max(largest_run.get(dataset, 0), evaluated_of[stem])
            runs_per_dataset[dataset] += 1
    for dataset, n in sorted(largest_run.items()):
        if n < DEV_SET_FLOOR:
            findings.add("small-corpus", "WARN", dataset,
                         f"{n} evaluated entries (best of {runs_per_dataset[dataset]} "
                         f"run(s)) < {DEV_SET_FLOOR} (development-set floor, corpus-design "
                         "§6.3) — diagnostic use only")
        elif n < SIGNIFICANCE_FLOOR:
            findings.add("small-corpus", "WARN", dataset,
                         f"{n} evaluated entries (best of {runs_per_dataset[dataset]} "
                         f"run(s)) < {SIGNIFICANCE_FLOOR} (significance floor, corpus-design "
                         "§6.3) — report CIs; make no cross-method significance claims")

    check_conditions_and_models(pairs, dataset_of, corrupted, findings)
    fingerprints = check_fingerprints(pairs, corrupted, findings)

    # --- card mode ----------------------------------------------------------
    if args.assemble or args.cards:
        compute_composite_score, classify_quality_tier = _harness_imports()
        if args.assemble:
            from mt_eval_harness.publish import assemble_run_card  # noqa: PLC0415
            for stem, (run, report) in sorted(pairs.items()):
                if run is None or report is None:
                    continue
                report_path = None
                for path in paths:
                    cand = (path if path.is_dir() else path.parent) / f"{stem}_report.json"
                    if cand.is_file():
                        report_path = cand
                        break
                if report_path is None:
                    continue
                try:
                    card, _card_id, _fp = assemble_run_card(report_path)
                except Exception as exc:  # publish-time failure is a finding, not a crash
                    findings.add("card", "ERROR", stem, f"assemble_run_card failed: {exc}")
                    continue
                check_card(stem, card, findings,
                           compute_composite_score, classify_quality_tier)
        for card_path in args.cards or []:
            try:
                card = json.loads(card_path.read_text(encoding="utf-8"))
            except (OSError, ValueError, UnicodeDecodeError) as exc:
                findings.add("card", "ERROR", str(card_path), f"unreadable: {exc}")
                continue
            check_card(card_path.name, card, findings,
                       compute_composite_score, classify_quality_tier)

    # --- output ---------------------------------------------------------------
    errors, warns, infos = (findings.count(s) for s in Findings.SEVERITIES)
    if args.json_out:
        print(json.dumps({
            "reportsScanned": len(pairs),
            "findings": findings.items,
            "summary": {s: findings.count(s) for s in Findings.SEVERITIES},
            "fingerprints": fingerprints,
        }, indent=2, ensure_ascii=False))
    else:
        print("=" * 66)
        print("  RUN REPORT LINT — score integrity sweep")
        print(f"  scanned: {len(pairs)} run pairs   registry: {len(registry)} datasets")
        print("=" * 66)
        for check, items in sorted(findings.by_check().items()):
            sev = items[0]["severity"]
            print(f"\n  [{check}] {sev} — {len(items)} finding(s):")
            for item in items[:25]:
                print(f"    {item['scope']}")
                print(f"      {item['message']}")
            if len(items) > 25:
                print(f"    … and {len(items) - 25} more (use --json)")
        print(f"\n  TOTALS: {errors} error(s), {warns} warning(s), {infos} info")
        if errors:
            print("  RESULT: FAIL — these reports must not be canonicalized/published\n")
        elif warns and args.strict:
            print("  RESULT: FAIL (--strict) — warnings present\n")
        else:
            print("  RESULT: PASS\n")

    if errors:
        return 1
    if args.strict and warns:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
