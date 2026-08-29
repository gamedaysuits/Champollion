#!/usr/bin/env python3
"""Baseline sweep driver: run the mt-eval harness across all curated corpora × a model lineup.

Design requirements (founder, 2026-06-11):
- Validate every model slug against the OpenRouter /models API before spending
  anything; record a pricing snapshot + timestamp per model (models drift).
- Hard budget ceiling with an early-stop checkpoint (default stop at 80%).
- Resume-safe: skips (corpus, model) pairs the manifest records as ok.
- No publishing — runs accumulate locally in eval/logs/harness/; publishing to
  the staging branch is a separate, reviewed step.

Usage:
  python3 scripts/run_baseline_sweep.py --models google/gemini-3.5-flash \
      --budget 2500 [--corpora-dir datasets/curated] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

ARENA = Path(__file__).resolve().parent.parent
# The card adapter (mt_eval_harness.language_cards) lives in the harness
# package; this script is usually invoked as scripts/run_baseline_sweep.py,
# which puts scripts/ — not arena/ — on sys.path.
if str(ARENA) not in sys.path:
    sys.path.insert(0, str(ARENA))
CARDS_DIR = ARENA.parent / "cli" / "shared" / "language-cards"
LOGS_DIR = ARENA / "eval" / "logs" / "harness"
MANIFEST = ARENA / "eval" / "logs" / "sweep_manifest.json"
OPENROUTER_MODELS = "https://openrouter.ai/api/v1/models"


def fetch_models() -> dict:
    last_err: Exception | None = None
    for attempt in (1, 2):
        try:
            with urllib.request.urlopen(OPENROUTER_MODELS, timeout=30) as resp:
                data = json.loads(resp.read())
            models = data.get("data")
            if not isinstance(models, list):
                raise SystemExit(
                    f"OpenRouter /models returned no 'data' list "
                    f"(keys: {sorted(data)[:6]}) — refusing to validate a "
                    f"lineup against an error envelope.")
            return {m["id"]: m for m in models}
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last_err = e
            if attempt == 1:
                time.sleep(3)
    raise SystemExit(f"OpenRouter /models unreachable after retry: {last_err}")


def target_lang_name(iso3: str) -> str | None:
    """Displayable language name via the ONE card adapter.

    Post-atlas-cutover, ``name`` can be an attribution envelope (a dict);
    reading it bare fed a dict into the run command line. ``display()``
    resolves the envelope and returns None on genuine disagreement — in
    which case we skip the corpus rather than elect a winner here.
    """
    card = CARDS_DIR / f"{iso3}.json"
    if not card.exists():
        return None
    from mt_eval_harness.language_cards import display
    data = json.loads(card.read_text(encoding="utf-8"))
    name = display(data.get("name"))
    return name if isinstance(name, str) and name.strip() else None


def corpus_meta(path: Path) -> tuple[str, int] | None:
    """Return (target_iso3, entry_count) from a curated corpus filename + content."""
    m = re.match(r"^[a-z]{3}-([a-z]{3})-dev-v\d+\.json$", path.name)
    if not m:
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    count = data.get("entry_count") or len(data.get("entries", []))
    return m.group(1), count


#: Conservative per-run reservation (USD) used when a run's cost cannot be
#: parsed from its output, and as the in-flight hold before a worker
#: launches — spend accounting must fail EXPENSIVE, never silent-zero.
RESERVE_USD = 0.50


def run_cost_from_output(text: str) -> tuple[float, bool]:
    """(cost, parsed) — parsed=False means the harness output carried no
    recognizable cost line (crash, timeout, format change). Callers must
    account a conservative reservation instead of 0.0: a silent zero would
    let the budget checkpoint sleep through real spending."""
    m = re.search(r"Total cost\s+\$([0-9.]+)", text)
    return (float(m.group(1)), True) if m else (0.0, False)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", required=True, help="OpenRouter slugs")
    ap.add_argument("--budget", type=float, default=2500.0)
    ap.add_argument("--stop-fraction", type=float, default=0.8,
                    help="Stop and report at this fraction of budget")
    ap.add_argument("--corpora-dir", default="datasets/curated")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--parallel", type=int, default=6,
                    help="Concurrent harness runs (each run is itself 8-way concurrent)")
    args = ap.parse_args()

    models = fetch_models()
    snapshot_ts = datetime.now(timezone.utc).isoformat()
    lineup = []
    for slug in args.models:
        if slug not in models:
            print(f"  ✗ SKIPPING {slug} — not on OpenRouter as of {snapshot_ts}")
            continue
        pricing = models[slug].get("pricing", {})
        lineup.append({"slug": slug, "pricing": pricing, "validated_at": snapshot_ts})
        print(f"  ✓ {slug}  in:{pricing.get('prompt')}  out:{pricing.get('completion')}")
    if not lineup:
        print("No valid models — aborting.")
        return 1

    corpora = sorted((ARENA / args.corpora_dir).glob("*-dev-v*.json"))
    print(f"\n{len(corpora)} corpora × {len(lineup)} models, budget ${args.budget:.2f} "
          f"(stop at {args.stop_fraction:.0%})\n")

    manifest = {"started": snapshot_ts, "budget": args.budget, "lineup": lineup, "runs": []}
    if MANIFEST.exists():
        try:
            prior = json.loads(MANIFEST.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            raise SystemExit(
                f"FATAL: {MANIFEST} is unreadable ({e}). The manifest is the "
                f"spend ledger — refusing to sweep without it. Restore it "
                f"from git or move it aside DELIBERATELY before re-running.")
        manifest["runs"] = prior.get("runs", [])
    spent = sum(r.get("cost", 0.0) for r in manifest["runs"])

    def write_manifest() -> None:
        # tmp+rename: a kill mid-write must never brick the spend ledger.
        tmp = MANIFEST.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        tmp.replace(MANIFEST)

    # Build the work queue up front. The manifest is the authoritative record
    # of completed (corpus, model) pairs — filename-based report matching
    # proved unreliable (44 duplicate re-runs on 2026-06-11).
    completed = {(r["corpus"], r["model"]) for r in manifest["runs"] if r.get("ok")}
    queue: list[tuple[Path, str, str, int]] = []
    for model in lineup:
        slug = model["slug"]
        for corpus in corpora:
            meta = corpus_meta(corpus)
            if meta is None:
                continue
            iso3, count = meta
            lang = target_lang_name(iso3)
            if not lang:
                print(f"  ? no language card name for {iso3}, skipping {corpus.name}")
                continue
            if (corpus.stem, slug) in completed:
                print(f"  = done already (manifest): {corpus.stem} × {slug}")
                continue
            queue.append((corpus, slug, lang, count))

    print(f"\n{len(queue)} runs queued, {args.parallel} parallel workers\n")
    if args.dry_run:
        for corpus, slug, lang, count in queue:
            print(f"→ would run {corpus.stem} ({count} entries, {lang}) × {slug}")
        return 0

    lock = threading.Lock()
    # `reserved` holds a conservative estimate for every launched-but-
    # unaccounted run, so six parallel workers cannot all clear the budget
    # checkpoint before any of them records a cost (the 2026-08-27 audit's
    # H5). The reservation is released when the real cost lands.
    state = {"spent": spent, "reserved": 0.0, "stopped": False}
    # Run ids carry an entropy suffix (runner._build_run_id) and run-log
    # writes are collision-proof (pipeline.write_run_log), so simultaneous
    # starts no longer need a stagger; the gate only serializes spawns.
    launch_gate = threading.Lock()

    def worker(item: tuple[Path, str, str, int]) -> None:
        corpus, slug, lang, count = item
        with lock:
            if state["stopped"]:
                return
            committed = state["spent"] + state["reserved"] + RESERVE_USD
            if committed >= args.budget * args.stop_fraction:
                state["stopped"] = True
                print(f"\nBUDGET CHECKPOINT: ${state['spent']:.2f} spent + "
                      f"${state['reserved']:.2f} in flight "
                      f"≥ {args.stop_fraction:.0%} of ${args.budget:.2f}. "
                      f"Stopping queue.")
                return
            state["reserved"] += RESERVE_USD
        with launch_gate:
            proc = subprocess.Popen(
                [sys.executable, "-m", "mt_eval_harness.cli", "run",
                 "--corpus", str(corpus), "--model", slug, "--target-lang", lang],
                cwd=ARENA, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL, text=True)
        print(f"→ {corpus.stem} ({count} entries, {lang}) × {slug}")
        try:
            stdout, stderr = proc.communicate(timeout=3600)
        except subprocess.TimeoutExpired:
            proc.kill()
            stdout, stderr = proc.communicate()
        cost, parsed = run_cost_from_output(stdout)
        ok = proc.returncode == 0
        with lock:
            state["reserved"] = max(0.0, state["reserved"] - RESERVE_USD)
            if not parsed:
                # No cost line (crash / timeout / format change): account the
                # conservative reservation, never a silent zero — spending may
                # have happened before the failure.
                cost = RESERVE_USD
                print(f"  ⚠ cost line missing for {corpus.stem} × {slug} — "
                      f"accounting ${RESERVE_USD:.2f} reservation instead of 0")
            state["spent"] += cost
            run_rec = {
                "corpus": corpus.stem, "model": slug, "lang": lang,
                "cost": cost, "ok": ok, "ts": datetime.now(timezone.utc).isoformat(),
            }
            if not parsed:
                run_rec["cost_parse_failed"] = True
            manifest["runs"].append(run_rec)
            write_manifest()
            tail = stdout.strip().splitlines()[-1] if stdout.strip() else ""
            print(f"  {'✓' if ok else '✗'} {corpus.stem} × {slug}  ${cost:.4f}  "
                  f"[total ${state['spent']:.2f}]  {tail[:60]}")
            if not ok:
                err = (stderr or stdout).strip().splitlines()
                print("    " + "\n    ".join(err[-5:]))

    with ThreadPoolExecutor(max_workers=max(1, args.parallel)) as pool:
        futures = [pool.submit(worker, item) for item in queue]
        for f in as_completed(futures):
            f.result()

    with lock:
        write_manifest()
        print(f"\nSweep {'stopped at budget checkpoint' if state['stopped'] else 'complete'}. "
              f"Total spent this manifest: ${state['spent']:.2f}")
        return 2 if state["stopped"] else 0


if __name__ == "__main__":
    sys.exit(main())
