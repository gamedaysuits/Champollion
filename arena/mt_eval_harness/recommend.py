"""
Method recommendation for a language pair — the routing evidence surface.

``mt-eval recommend SRC TGT`` answers the practical question a translator-
integrator actually has: *"I need to translate SRC→TGT — what are my options,
what does the published evidence say, and what can I actually run right
now?"* — while refusing to overclaim (master-plan workstream E4, founder
directive 2026-07-07).

Three evidence tiers are consulted, all offline (shared/ artifacts — no
network, no credentials):

  1. **Dispatchable methods** — ``shared/method-registry.json`` (the
     cross-runtime SSOT): every engine/provider the harness or the champollion
     CLI can invoke, with per-method AVAILABILITY resolved live (is its API
     key in the environment? is it harness-only? is its license commercial-
     ready?).
  2. **Curated cited results** — ``shared/catalogue/external-results.json``:
     hand-verified published datapoints (cited ≠ reproduced), direction-exact.
  3. **Bulk cited results** — ``shared/catalogue/external-mt-index.json``:
     the machine-imported best-published-score index (OPUS-MT leaderboard
     family), RELATIVE-ONLY lane by construction.

HONESTY CONTRACT (the whole point):
  * Cited evidence orders methods *relative to each other on a memorized
    public benchmark* — it is never absolute quality and never a deployment
    ranking. Every rendered section says so (contamination.py lanes).
  * Evidence and dispatchability are DIFFERENT axes: the best-evidenced model
    for a pair (say NLLB-200) may not be runnable in Champollion, and may be
    NC-licensed (weights CC-BY-NC → excluded from commercial-lane
    recommendations). The output keeps "best evidenced" and "runnable now"
    visibly separate and joins them only with explicit caveats.
  * No evidence → say exactly that, and point at the runnable corpora
    (``mt-eval corpora``) so the user can MEASURE rather than guess. An
    honest "we don't know" beats a fabricated ranking.
  * Standalone pip installs may lack the shared/ artifacts — each tier
    degrades to an explicit "not available" note, never silently.

This module is pure logic over the shared artifacts; loaders take explicit
paths so tests can inject fixtures.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from mt_eval_harness.contamination import (
    LANE_RELATIVE_ONLY,
    lane_for_grade,
    normalize_grade,
)
from mt_eval_harness.method_manifest import load_method_manifest

_PACKAGE_DIR = Path(__file__).resolve().parent


# ---------------------------------------------------------------------------
# Shared-artifact resolution (mirrors method_manifest.manifest_path)
# ---------------------------------------------------------------------------

def catalogue_path(filename: str) -> Path | None:
    """Find shared/catalogue/<filename> by walking up from the package.

    Returns None in a standalone install — callers render an explicit
    "index not available" note, never a silent skip.
    """
    check = _PACKAGE_DIR
    for _ in range(6):
        candidate = check / "shared" / "catalogue" / filename
        if candidate.exists():
            return candidate
        check = check.parent
    return None


def _load_json(path: Path | None) -> dict | None:
    if path is None:
        return None
    return json.loads(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Tier 1 — dispatchable methods + live availability
# ---------------------------------------------------------------------------

def resolve_availability(entry: dict, env: dict[str, str] | None = None) -> dict:
    """Resolve one method-registry entry to a live availability verdict.

    Returns {status, detail} where status ∈:
      ready        — invocable right now (needed credential(s) present, or none needed)
      needs-key    — adapter exists; set the named env var(s)
      local-setup  — local engine; needs the optional install/extra

    Readiness is judged on the entry's CREDENTIAL vars only: ``credential_env``
    when declared, else the full ``env`` list. The registry ``env`` list also
    names non-credential config vars (AWS_REGION, *_ENDPOINT) the adapter
    reads — those must never make a method read "ready" (a region is not
    auth). ``credential_env_all: true`` marks key-pair auth: EVERY credential
    var is required (AWS access-key id + secret, Lara id + secret), where the
    default any-of semantics fit alias lists (canonical key or its alias).
    """
    env = os.environ if env is None else env
    cred_vars = entry.get("credential_env")
    check_vars = cred_vars if cred_vars is not None else (entry.get("env") or [])
    need_all = bool(entry.get("credential_env_all"))
    kind = entry.get("kind", "")
    extra = entry.get("optional_extra")
    extra_note = f" (requires pip extra '{extra}')" if extra else ""

    if kind == "local-model":
        return {
            "status": "local-setup",
            "detail": f"local engine — install extra '{extra}'" if extra
                      else "local engine — see homepage for setup",
        }
    if not check_vars:
        return {"status": "ready",
                "detail": "no credentials required" + extra_note}
    present = [v for v in check_vars if env.get(v)]
    if need_all:
        missing = [v for v in check_vars if not env.get(v)]
        if not missing:
            return {"status": "ready",
                    "detail": " + ".join(check_vars) + " are set" + extra_note}
        qualifier = (f" ({present[0]} alone is not enough)" if present
                     else " (all required)")
        return {"status": "needs-key",
                "detail": "set " + " + ".join(missing) + qualifier + extra_note}
    if present:
        return {"status": "ready", "detail": f"{present[0]} is set" + extra_note}
    return {
        "status": "needs-key",
        "detail": "set " + " or ".join(check_vars) + extra_note,
    }


def dispatchable_methods(
    use_context: str,
    manifest: dict | None = None,
    env: dict[str, str] | None = None,
) -> list[dict]:
    """Tier-1 rows: every registry method with availability + lane verdicts.

    ``use_context`` ∈ {'non-commercial', 'commercial'}: the commercial lane
    is STRICT (mirrors license_use.py) — a method whose ``commercialReady``
    is not True is excluded-with-reason, never silently dropped.
    """
    manifest = manifest if manifest is not None else load_method_manifest()
    if not manifest:
        return []
    rows = []
    for name, entry in (manifest.get("entries") or {}).items():
        avail = resolve_availability(entry, env=env)
        runtimes = entry.get("runtimes") or ["harness", "cli"]
        lane_ok = True
        lane_note = None
        if use_context == "commercial" and entry.get("commercialReady") is not True:
            lane_ok = False
            lane_note = (f"excluded from the commercial lane — "
                         f"license: {entry.get('license', 'unknown')}")
        rows.append({
            "method": name,
            "kind": entry.get("kind"),
            "paradigm": entry.get("paradigm"),
            "license": entry.get("license"),
            "commercial_ready": bool(entry.get("commercialReady")),
            "runtimes": runtimes,
            "availability": avail["status"],
            "availability_detail": avail["detail"],
            "lane_ok": lane_ok,
            "lane_note": lane_note,
            "cost_note": entry.get("cost_note"),
        })
    order = {"ready": 0, "needs-key": 1, "local-setup": 2}
    rows.sort(key=lambda r: (not r["lane_ok"], order.get(r["availability"], 9),
                             r["method"]))
    return rows


# ---------------------------------------------------------------------------
# Tier 2 — curated cited results (direction-exact)
# ---------------------------------------------------------------------------

def curated_evidence(
    src: str, tgt: str,
    catalogue: dict | None = None,
) -> tuple[list[dict], dict[str, dict]]:
    """Direction-exact curated datapoints + the cited-methods index.

    Returns (rows, methods_index). Rows carry per-datapoint provenance;
    ranking across different (benchmark, metric) buckets is deliberately NOT
    performed — metric variants are incomparable (metric_variant_flag).
    """
    if catalogue is None:
        catalogue = _load_json(catalogue_path("external-results.json"))
    if not catalogue:
        return [], {}
    methods_index = {m.get("id"): m for m in catalogue.get("methods") or []}
    rows = []
    for r in catalogue.get("results") or []:
        pair = r.get("pair") or {}
        if pair.get("source") != src or pair.get("target") != tgt:
            continue
        grade = normalize_grade((r.get("signal_strength") or {}).get("contamination"))
        rows.append({
            "tier": "curated",
            "model": r.get("model"),
            "benchmark": r.get("benchmark"),
            "metric": r.get("metric"),
            "value": r.get("value"),
            "lower_is_better": bool(r.get("lower_is_better")),
            "grade": (r.get("signal_strength") or {}).get("grade"),
            "lane": lane_for_grade(grade) if grade else LANE_RELATIVE_ONLY,
            "verified": bool(r.get("verified")),
            "citation": r.get("citation"),
            "source_url": r.get("source_url"),
            "method_ref": r.get("method_ref"),
        })
    return rows, methods_index


# ---------------------------------------------------------------------------
# Tier 3 — bulk cited index (relative-only by construction)
# ---------------------------------------------------------------------------

def _base_code(code: str) -> str:
    """Strip a FLORES-style script suffix: 'ace_Arab' → 'ace'."""
    return code.split("_", 1)[0]


def bulk_evidence(
    src: str, tgt: str,
    index: dict | None = None,
    max_rows: int = 8,
) -> tuple[list[dict], dict[str, Any]]:
    """Best-published rows for the pair from the bulk index.

    Pair keys are upstream codes (may carry script suffixes); we match on the
    script-stripped base and surface the exact upstream key on each row so
    nothing is silently relabelled. Returns (rows, meta).
    """
    if index is None:
        index = _load_json(catalogue_path("external-mt-index.json"))
    if not index:
        return [], {}
    models = index.get("models") or []
    posture = index.get("contamination_posture") or {}
    rows = []
    for key, cells in (index.get("pairs") or {}).items():
        s, _, t = key.partition("-")
        if _base_code(s) != src or _base_code(t) != tgt:
            continue
        for testset, metrics in cells.items():
            for metric, (model_idx, value) in metrics.items():
                model = (models[model_idx]
                         if isinstance(model_idx, int) and model_idx < len(models)
                         else str(model_idx))
                rows.append({
                    "tier": "bulk",
                    "pair_key": key,
                    "model": model,
                    "benchmark": testset,
                    "metric": metric,
                    "value": value,
                    "lane": LANE_RELATIVE_ONLY,
                    "posture": posture.get(testset),
                })
    rows.sort(key=lambda r: (r["benchmark"], r["metric"], r["pair_key"]))
    meta = {
        "provider": index.get("provider"),
        "provenance": index.get("provenance"),
        "truncated": len(rows) > max_rows,
        "total_rows": len(rows),
    }
    return rows[:max_rows], meta


# ---------------------------------------------------------------------------
# Tier 4 — metric-reliability evidence (which metric to BELIEVE for the target)
# ---------------------------------------------------------------------------

def metric_reliability_evidence(
    tgt: str,
    reliability: dict | None = None,
) -> tuple[dict | None, list[str]]:
    """Per-target-family metric↔human correlation evidence (workstream B3).

    Answers a different question from tiers 1–3: not "which SYSTEM scores
    best" but "which METRIC can you trust to score output in this target
    language". Sourced from shared/catalogue/metric-reliability.json — the
    champollion-derived correlations between automatic metrics and the WMT
    Metrics-task human judgments (wmt19–wmt25); methodology spec:
    https://champollion.dev/docs/network/specifications/metric-reliability

    Returns (section | None, notes). Fail-honest: an absent index, or a
    target language no WMT campaign ever judged, yields an explicit note —
    never a silent skip and never borrowed numbers.
    """
    if reliability is None:
        reliability = _load_json(catalogue_path("metric-reliability.json"))
        if reliability is None:
            return None, [
                "Metric-reliability index not available in this install — "
                "metric-trust tier skipped explicitly."
            ]
    languages = reliability.get("languages") or {}
    code = info = None
    for key, entry in sorted(languages.items()):
        if tgt == key or tgt == (entry or {}).get("iso639_3"):
            code, info = key, entry
            break
    if info is None:
        return None, [
            f"No WMT human-judgment meta-evaluation covers target '{tgt}' "
            f"(directly or via its family) — metric choice for this language "
            f"is UNMEASURED. Treat every metric as unvalidated there; "
            f"prefer metrics with morphology-robust behaviour and validate "
            f"locally where possible."
        ]
    notes: list[str] = []
    family = info.get("family") or "Unclassified"
    fam_block = (reliability.get("families") or {}).get(family) or {}
    metrics_out = []
    for metric_id, levels in sorted((fam_block.get("metrics") or {}).items()):
        sys_e = levels.get("sys") or {}
        seg_e = levels.get("seg") or {}
        metrics_out.append({
            "metric": metric_id,
            "sys_pearson": sys_e.get("pearson_weighted_mean"),
            "sys_pairwise_accuracy": sys_e.get("pairwise_accuracy_weighted_mean"),
            "sys_n_pairs": sys_e.get("n_pairs"),
            "seg_kendall": seg_e.get("kendall_tau_b_weighted_mean"),
            "seg_n_pairs": seg_e.get("n_pairs"),
        })
    metrics_out.sort(
        key=lambda m: -2.0 if m["sys_pearson"] is None else -m["sys_pearson"])
    exact_pairs = sorted({
        c["pair"] for c in reliability.get("cells") or []
        if c.get("tgt") == code and c.get("preferred")
    })
    if not exact_pairs:
        notes.append(
            f"Family-level metric evidence only: the '{family}' correlations "
            f"come from other {family} target languages, never from '{tgt}' "
            f"itself — transfer within a family is an assumption, not a "
            f"measurement."
        )
    lane = reliability.get("license_lane") or {}
    if lane.get("commercial_ok") is False:
        notes.append(
            "Metric-reliability evidence rides a non-commercial hold (the "
            "upstream WMT judgment data license is unstated, founder review "
            "pending) — cite it in research lanes only."
        )
    section = {
        "target_code": code,
        "target_iso639_3": info.get("iso639_3"),
        "target_family": family,
        "exact_pairs_measured": exact_pairs,
        "family_metrics": metrics_out,
        "provenance": reliability.get("provenance"),
    }
    return section, notes


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------

def recommend(
    src: str, tgt: str, *,
    use_context: str = "non-commercial",
    manifest: dict | None = None,
    curated: dict | None = None,
    bulk: dict | None = None,
    reliability: dict | None = None,
    env: dict[str, str] | None = None,
) -> dict:
    """Assemble the full recommendation payload for one directed pair."""
    methods = dispatchable_methods(use_context, manifest=manifest, env=env)
    curated_rows, cited_methods = curated_evidence(src, tgt, catalogue=curated)
    bulk_rows, bulk_meta = bulk_evidence(src, tgt, index=bulk)
    reliability_section, reliability_notes = metric_reliability_evidence(
        tgt, reliability=reliability)

    # Join: which cited models are dispatchable / commercially deployable?
    evidenced_models = []
    seen = set()
    for row in curated_rows:
        ref = row.get("method_ref")
        if not ref or ref in seen:
            continue
        seen.add(ref)
        m = cited_methods.get(ref) or {}
        evidenced_models.append({
            "id": ref,
            "name": m.get("name"),
            "runnable_in_champollion": bool(m.get("runnable_in_champollion")),
            "commercial_use": m.get("commercial_use"),
            "license": m.get("license"),
        })

    notes = [
        "Cited evidence orders methods RELATIVE to each other on memorized "
        "public benchmarks — it is never absolute quality and never a "
        "deployment ranking (relative-comparison-only lane).",
        "Evidence and runnability are different axes: the best-evidenced "
        "model may not be dispatchable here, and NC-licensed weights are "
        "excluded from commercial-lane recommendations.",
    ]
    if curated is None and catalogue_path("external-results.json") is None:
        notes.append("Curated cited-results index not available in this "
                     "install — tier skipped explicitly.")
    if bulk is None and catalogue_path("external-mt-index.json") is None:
        notes.append("Bulk published-results index not available in this "
                     "install — tier skipped explicitly.")
    if not curated_rows and not bulk_rows:
        notes.append(
            f"NO published evidence indexed for {src}→{tgt}. That is the "
            f"honest answer — measure instead of guessing: "
            f"`mt-eval corpora --source {src} --target {tgt}` lists runnable "
            f"benchmarks, `mt-eval run` produces your own scored evidence."
        )
    notes.extend(reliability_notes)

    return {
        "pair": {"source": src, "target": tgt},
        "use_context": use_context,
        "runnable_methods": methods,
        "curated_evidence": curated_rows,
        "bulk_evidence": bulk_rows,
        "bulk_meta": bulk_meta,
        "evidenced_models": evidenced_models,
        "metric_reliability": reliability_section,
        "notes": notes,
    }


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

def render_text(payload: dict) -> str:
    """Human-readable rendering of a recommend() payload."""
    p = payload["pair"]
    out = [f"Method guidance — {p['source']} → {p['target']}   "
           f"(lane: {payload['use_context']})", ""]

    out.append("Runnable methods (shared/method-registry.json):")
    if not payload["runnable_methods"]:
        out.append("  (method registry not available in this install)")
    for m in payload["runnable_methods"]:
        badge = {"ready": "READY     ", "needs-key": "NEEDS KEY ",
                 "local-setup": "LOCAL     "}.get(m["availability"], "?         ")
        line = f"  {badge}{m['method']:<22}{m['availability_detail']}"
        if m["license"]:
            line += f"   [{m['license']}]"
        if not m["lane_ok"]:
            line = f"  EXCLUDED  {m['method']:<22}{m['lane_note']}"
        out.append(line)

    out.append("")
    out.append("Published evidence for this pair (cited — never reproduced "
               "by us; relative ordering only):")
    if not payload["curated_evidence"] and not payload["bulk_evidence"]:
        out.append("  none indexed.")
    for r in payload["curated_evidence"]:
        v = "verified" if r["verified"] else "UNVERIFIED"
        out.append(f"  [curated/{v}] {r['benchmark']} {r['metric']}="
                   f"{r['value']} — {r['model']}  (grade {r.get('grade')}; "
                   f"{r['citation']})")
    for r in payload["bulk_evidence"]:
        out.append(f"  [bulk] {r['benchmark']} {r['metric']}={r['value']} — "
                   f"{r['model']}  (pair key {r['pair_key']})")
    if payload["bulk_meta"].get("truncated"):
        out.append(f"  … {payload['bulk_meta']['total_rows']} bulk rows total "
                   f"(showing best-per-bucket head).")

    if payload["evidenced_models"]:
        out.append("")
        out.append("Evidenced models vs. dispatchability:")
        for m in payload["evidenced_models"]:
            bits = []
            bits.append("runnable in Champollion" if m["runnable_in_champollion"]
                        else "NOT dispatchable here yet")
            if m.get("commercial_use") is False:
                bits.append("weights NC — non-commercial only")
            out.append(f"  {m.get('name') or m['id']}: {'; '.join(bits)}")

    rel = payload.get("metric_reliability")
    if rel:
        out.append("")
        out.append(
            f"Metric trust for the target (family: {rel['target_family']} — "
            f"WMT human-judgment correlations; which metric to believe):")
        for m in rel["family_metrics"]:
            sp = "—" if m["sys_pearson"] is None else f"{m['sys_pearson']:+.2f}"
            sk = "—" if m["seg_kendall"] is None else f"{m['seg_kendall']:+.2f}"
            n = m["sys_n_pairs"] or m["seg_n_pairs"] or 0
            out.append(f"  {m['metric']:<18} sys-Pearson {sp:>5}   "
                       f"seg-Kendall {sk:>5}   ({n} pair(s))")
        measured = (", ".join(rel["exact_pairs_measured"])
                    if rel["exact_pairs_measured"] else "none — family-level only")
        out.append(f"  directly measured pairs for this target: {measured}")

    out.append("")
    for n in payload["notes"]:
        out.append(f"⚠ {n}")
    return "\n".join(out)
