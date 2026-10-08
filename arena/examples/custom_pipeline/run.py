"""
Custom Pipeline Example — Plugging a custom translation process.

Demonstrates how to implement the TranslationMethod protocol
to evaluate your own translation pipeline against the harness.

This example shows a dummy pipeline that reverses strings — in
practice you'd wrap your actual translation logic here.
"""

import asyncio
import time
from pathlib import Path

from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import execute_run
from mt_eval_harness.plugins.metrics import MetricPlugin


# ---------------------------------------------------------------------------
# Custom translation process (implements TranslationMethod protocol)
# ---------------------------------------------------------------------------

class ReverseTranslator:
    """Dummy pipeline that 'translates' by reversing the source text.

    In practice, replace this with your actual pipeline:
        - A local model inference
        - A custom API call chain
        - A rule-based generator
        - A multi-step agent pipeline
    """

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        results = []
        for entry in entries:
            start = time.monotonic()
            source = entry.get(config.source_field, entry.get("english", ""))

            # Your actual translation logic goes here
            predicted = source[::-1]  # Dummy: reverse the string

            elapsed = time.monotonic() - start
            results.append({
                "id": entry["id"],
                "predicted": predicted,
                "latency_s": round(elapsed, 3),
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {"pipeline": "reverse_example"},
            })
        return results


# ---------------------------------------------------------------------------
# Custom metric plugin
# ---------------------------------------------------------------------------

class LengthRatioMetric:
    """Example metric that checks if predicted/reference length ratio is sane."""

    name = "length_ratio"

    def compute(self, entry: dict) -> dict:
        pred_len = len(entry.get("predicted", ""))
        ref_len = len(entry.get("expected", ""))
        ratio = pred_len / max(ref_len, 1)
        return {
            "pred_length": pred_len,
            "ref_length": ref_len,
            "length_ratio": round(ratio, 3),
        }

    def aggregate(self, entry_results: list[dict]) -> dict:
        ratios = [r.get("length_ratio", 0) for r in entry_results if "error" not in r]
        if not ratios:
            return {}
        return {
            "avg_length_ratio": round(sum(ratios) / len(ratios), 3),
            "min_length_ratio": round(min(ratios), 3),
            "max_length_ratio": round(max(ratios), 3),
        }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    corpus_path = Path(__file__).parent.parent / "basic_run" / "sample_corpus.json"

    config = RunConfig(
        corpus_path=str(corpus_path),
        source_field="english",
        target_field="spanish",
        dataset="all",
        batch_size=1,
        process_name="reverse_translator",
        output_dir="examples/custom_pipeline/output",
        run_name="custom_pipeline_demo",
    )

    # Create pipeline and metric instances
    pipeline = ReverseTranslator()
    length_metric = LengthRatioMetric()

    # Execute run with custom process
    run_log = await execute_run(
        config,
        process=pipeline,
        metric_plugins=[length_metric],
    )
    print(f"\nRun complete! {run_log['total_entries']} entries processed.")

    # Now analyze the results
    from mt_eval_harness.tester import analyze_run
    output_dir = Path(config.output_dir)
    log_files = list(output_dir.glob("*.json"))
    if log_files:
        report = analyze_run(
            log_files[-1],
            metric_plugins=[length_metric],
        )
        print(f"Exact match rate: {report['overall']['exact_match_rate']:.1%}")


if __name__ == "__main__":
    asyncio.run(main())
