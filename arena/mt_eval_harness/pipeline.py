"""
Pipeline — Shared concerns for all execution strategies.

This module extracts the cross-cutting logic that was previously
duplicated across all four branches of the God Function in runner.py:
    - Post-translation hook application
    - Result enrichment (corpus metadata + cost estimation)
    - RunLog assembly and disk write
    - Progress reporting

Why a separate module instead of a base class:
    Strategies have different concurrency patterns (gather vs sequential),
    so inheritance would force awkward template-method contortions.
    Composition is cleaner — strategies call these functions explicitly.
"""

from __future__ import annotations

import json
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mt_eval_harness import __version__
from mt_eval_harness.config import RunConfig
from mt_eval_harness.api import estimate_cost


# ---------------------------------------------------------------------------
# Post-translation hook application
# ---------------------------------------------------------------------------

async def apply_hooks(
    entry: dict,
    result: dict,
    hooks: list,
    config: RunConfig,
    api_fn: Any | None = None,
) -> dict:
    """Apply registered post-translation hooks to a single result.

    Hooks run in registration order. If the result has an error,
    hooks are skipped — corrupted data shouldn't be post-processed.

    Args:
        entry: The original corpus entry.
        result: The translation result dict.
        hooks: List of PostTranslationHook plugins.
        config: Run configuration.
        api_fn: Optional API function for hooks that need LLM calls
                (e.g., grammar verification hooks).

    Returns:
        The (potentially modified) result dict.
    """
    if result.get("error"):
        return result

    for hook in hooks:
        result = await hook.process(entry, result, config, api_fn=api_fn)

    return result


# ---------------------------------------------------------------------------
# Result enrichment — merge corpus metadata + cost estimation
# ---------------------------------------------------------------------------

def enrich_results(
    results: list[dict],
    corpus: list[dict],
    config: RunConfig,
    pricing: dict | None = None,
) -> tuple[list[dict], float]:
    """Enrich raw results with corpus metadata and cost estimates.

    Each result gets merged with its corresponding corpus entry to
    produce the full schema that tester.py and the dashboard expect.

    Args:
        results: Raw translation results from a strategy.
        corpus: The full corpus entries (for source/expected/segment).
        config: Run configuration (for field name mapping).
        pricing: OpenRouter pricing data for cost estimation.

    Returns:
        Tuple of (enriched results list, total cost in USD).
    """
    corpus_by_id = {e["id"]: e for e in corpus}
    enriched = []
    total_cost = 0.0   # actual API spend THIS run (cache hits excluded)
    cached_cost = 0.0  # original price of the cache-hit entries
    # All entries in a run use the same model, so cost is all-or-nothing:
    # if the model can't be priced, the run's total is UNKNOWN (None), never a
    # misleading partial/zero sum.
    cost_known = True

    for result in results:
        entry = corpus_by_id.get(result["id"], {})
        entry_cost = estimate_cost(
            result.get("usage", {}),
            config.model_id,
            pricing,
        )
        # Cache hits cost nothing this run — report actual spend
        # accurately, with the original price carried alongside
        # (by design).
        if entry_cost is None:
            cost_known = False  # un-priceable model — total stays unknown
        elif result.get("cached"):
            cached_cost += entry_cost
        else:
            total_cost += entry_cost

        enriched.append({
            "id": result["id"],
            "cached": bool(result.get("cached", False)),
            "source": entry.get(config.source_field, ""),
            "expected": entry.get(config.target_field, ""),
            "raw_predicted": result.get("raw_predicted", result.get("predicted", "")),
            "predicted": result.get("predicted", ""),
            "segment": entry.get("segment", ""),
            "difficulty": entry.get("difficulty", 0),
            "domain": entry.get("domain", ""),
            "latency_s": result.get("latency_s", 0),
            "usage": result.get("usage", {}),
            "cost_usd": entry_cost,
            "tool_calls": result.get("tool_calls", []),
            "tool_call_count": result.get("tool_call_count", 0),
            "error": result.get("error"),
            "metadata": result.get("metadata", {}),
        })

    # When the model is un-priceable, surface UNKNOWN (None) rather than a
    # fabricated $0 total — the per-entry cost_usd fields are already None.
    final_total = round(total_cost, 4) if cost_known else None
    final_cached = round(cached_cost, 4) if cost_known else None
    return enriched, final_total, final_cached


# ---------------------------------------------------------------------------
# RunLog assembly
# ---------------------------------------------------------------------------

def build_run_log(
    config: RunConfig,
    enriched_results: list[dict],
    run_id: str,
    timestamp_start: str,
    elapsed_s: float,
    cache_hits: int,
    total_cost: float,
    cached_cost: float = 0.0,
    system_prompt: str = "",
    system_prompt_sha256: str = "",
    corpus_sha256: str = "",
    dataset_meta: dict | None = None,
    method_card: dict | None = None,
    coaching_prompt: str | None = None,
    coaching_prompt_sha256: str | None = None,
) -> dict:
    """Assemble the complete RunLog dict.

    The RunLog is the primary output artifact — it contains everything
    needed to reproduce and analyze the run. The config snapshot ensures
    any logged result can be exactly reproduced.

    The 'provenance' block captures reproducibility identifiers required
    by BENCHMARK_SPEC §3: system prompt hash, corpus file hash, method
    card (if using a plugin), coaching prompt text + hash, and dataset
    envelope metadata (version, license, etc.).
    """
    provenance = {
        "system_prompt_used": system_prompt,
        "system_prompt_sha256": system_prompt_sha256,
        "corpus_sha256": corpus_sha256,
        "dataset_meta": dataset_meta or {},
    }

    # Method card — when a method plugin is used, embed its self-description
    # so the run log fully identifies the method, not just the model.
    if method_card is not None:
        provenance["method_card"] = method_card

    # Coaching prompt — store the full text for reproducibility.
    # Two runs with different coaching produce different hashes,
    # even if all other config is identical.
    if coaching_prompt is not None:
        provenance["coaching_prompt"] = coaching_prompt
        provenance["coaching_prompt_sha256"] = coaching_prompt_sha256 or ""

    # Contamination self-attestation — recorded prominently in provenance (the
    # trust-relevant reproducibility block) so the trust UI can surface that
    # the submitter affirmed their method was not trained on this corpus. It is
    # ALSO captured in config (config.to_dict) for completeness.
    attestation = getattr(config, "contamination_attestation", None)
    if attestation:
        provenance["contamination_attestation"] = attestation

    # Transmission policy — the channel discipline this run's corpus text
    # travelled under (restricted corpora: no-train channels only; see
    # transmission_policy.py). Also inside config.to_dict(); duplicated here
    # so trust surfaces read it beside the other provenance identifiers.
    transmission = getattr(config, "transmission_policy", None)
    if transmission:
        provenance["transmission_policy"] = transmission

    return {
        "harness_version": __version__,
        "run_id": run_id,
        "config": config.to_dict(),
        "timestamp_start": timestamp_start,
        "timestamp_end": datetime.now(timezone.utc).isoformat(),
        "elapsed_s": round(elapsed_s, 1),
        "total_entries": len(enriched_results),
        "cache_hits": cache_hits,
        # total_cost_usd is ACTUAL spend this run; cached entries carry
        # their original price in cached_cost_usd.
        "total_cost_usd": total_cost,
        "cached_cost_usd": cached_cost,
        "provenance": provenance,
        "results": enriched_results,
    }


def write_run_log(run_log: dict, output_dir: str) -> Path:
    """Write the RunLog to disk as JSON.

    Creates the output directory if it doesn't exist.

    Returns:
        The path to the written file.
    """
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    output_path = out_dir / f"{run_log['run_id']}.json"
    if output_path.exists():
        # Defense in depth behind the entropy suffix in run ids: a log must
        # never clobber another run's — a collision corrupts BOTH run/report
        # pairs (the report of one run paired with the log of another).
        run_log["run_id"] = f"{run_log['run_id']}_{secrets.token_hex(3)}"
        output_path = out_dir / f"{run_log['run_id']}.json"
    output_path.write_text(
        json.dumps(run_log, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return output_path


# ---------------------------------------------------------------------------
# Progress reporting
# ---------------------------------------------------------------------------

def report_progress(done: int, total: int) -> None:
    """Print a live inline progress bar that updates after every batch.

    Uses carriage-return (\r) to overwrite the same line.  When done
    reaches total, a final newline is printed so subsequent output
    starts on a fresh line.  No dependency on rich/tqdm — just print().
    """
    if total == 0:
        return
    pct = done / total
    bar_width = 30
    filled = int(bar_width * pct)
    bar = "█" * filled + "░" * (bar_width - filled)
    line = f"\r  {bar} {done}/{total} ({pct:.0%})"
    if done >= total:
        print(line, flush=True)
    else:
        print(line, end="", flush=True)

