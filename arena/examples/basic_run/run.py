"""
Basic Run Example — Minimal harness execution.

Demonstrates how to run the harness on a small corpus with
default settings. This is the simplest possible integration.

Usage:
    python examples/basic_run/run.py
"""

import asyncio
from pathlib import Path

from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import execute_run


async def main():
    corpus_path = Path(__file__).parent / "sample_corpus.json"

    config = RunConfig(
        corpus_path=str(corpus_path),
        source_field="english",        # Which field is the source text
        target_field="spanish",         # Which field is the reference translation
        model="gemini-pro",              # Model to use (alias for google/gemini-3.1-pro-preview)
        prompt_version="naive",         # Built-in minimal prompt
        dataset="all",                  # Use all entries
        batch_size=1,                   # One entry per API call
        concurrency=4,                  # 4 parallel calls
        cache_enabled=True,             # Cache results for re-runs
        output_dir="examples/basic_run/output",
        run_name="basic_example",
    )

    run_log = await execute_run(config)
    print(f"\nRun complete! {run_log['total_entries']} entries processed.")
    print(f"Cost: ${run_log['total_cost_usd']:.4f}")


if __name__ == "__main__":
    asyncio.run(main())
