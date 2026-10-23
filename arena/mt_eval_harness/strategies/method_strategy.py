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

import time

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
            t0 = time.monotonic()
            results = await self._method.translate(batch, config)
            elapsed = time.monotonic() - t0
            _fill_latency(results, elapsed, len(batch))
            all_results.extend(results)
            done_count += len(batch)
            report_progress(done_count, total)

        return all_results, 0


def _fill_latency(results: list, elapsed: float, n: int) -> None:
    """Give every result that carries no time above zero the harness's own
    measurement: the wall-clock of the ``translate()`` call ÷ the entries it
    received (6 decimals, so a fast call is never recorded as 0). A time the
    method reports itself is kept. A plugin's results came back with
    ``latency_s: 0.0`` and compare showed "Avg latency 0.00" as if measured
    (synthetic Cree school, Round 12); timing the call is free."""
    per_entry = round(elapsed / max(n, 1), 6)
    for r in results or []:
        if not isinstance(r, dict):
            continue
        given = r.get("latency_s")
        if (isinstance(given, (int, float)) and not isinstance(given, bool)
                and given > 0):
            continue
        r["latency_s"] = per_entry
        meta = r.get("metadata")
        if not isinstance(meta, dict):
            meta = {}
            r["metadata"] = meta
        meta.setdefault("latency_source",
                        "harness: wall-clock of translate() ÷ entries in the "
                        "call (the method reported none)")
