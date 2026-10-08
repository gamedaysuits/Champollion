"""Passthrough method — the smallest possible TranslationMethod plugin.

Returns the source text as the "translation". Useful for:
  - verifying the --method plugin wiring end-to-end with zero API cost
  - a floor baseline (what does scoring give a non-translation?)

Never publish passthrough runs as a real method.
"""

from __future__ import annotations

import time


class PassthroughMethod:
    """Implements the TranslationMethod protocol structurally."""

    @property
    def name(self) -> str:
        return "passthrough"

    def method_card(self) -> dict | None:
        return {
            "name": "Passthrough (wiring example)",
            "method_id": "example-passthrough-v1",
            "class": "example",
            "description": "Source text returned unchanged (wiring test).",
        }

    async def translate(self, entries: list[dict], config) -> list[dict]:
        start = time.monotonic()
        results = []
        for entry in entries:
            results.append({
                "id": entry["id"],
                "predicted": entry.get(config.source_field, ""),
                "latency_s": round(time.monotonic() - start, 6),
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "cost": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {"passthrough": True},
            })
        return results
