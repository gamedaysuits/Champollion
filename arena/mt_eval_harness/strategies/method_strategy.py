"""
Method Strategy — Delegate to a TranslationMethod plugin.

This is the thinnest strategy. It simply calls the method's
translate() method and wraps the results. Custom pipelines
(e.g., decomp-recomp, backtranslation, fine-tuned model endpoints)
implement the TranslationMethod protocol and get evaluated
identically to the built-in strategies.

The method is a black box: the harness gives it source text and
scores whatever comes back.
"""
from __future__ import annotations

from mt_eval_harness.config import RunConfig, TranslationMethod
from mt_eval_harness.pipeline import report_progress


def _chunk(items: list, size: int) -> list[list]:
    """Split a list into chunks of the given size."""
    return [items[i:i + size] for i in range(0, len(items), size)]


class MethodStrategy:
    """Delegate translation to a custom TranslationMethod plugin.

    The method handles all API calls, tool usage, and post-processing
    internally. This strategy just manages batching and progress.
    """

    def __init__(self, method: TranslationMethod):
        self._method = method

    async def execute(
        self,
        entries: list[dict],
        config: RunConfig,
        **kwargs,
    ) -> tuple[list[dict], int]:
        """Execute method plugin translation for all entries.

        The method's translate() receives batches of entries
        and returns one result dict per entry.

        Returns:
            Tuple of (results list, cache_hits count).
            Cache hits is always 0 — methods manage their own caching.
        """
        total = len(entries)
        done_count = 0
        all_results = []

        batches = _chunk(entries, config.batch_size)
        for batch in batches:
            results = await self._method.translate(batch, config)
            all_results.extend(results)
            done_count += len(batch)
            report_progress(done_count, total)

        return all_results, 0
