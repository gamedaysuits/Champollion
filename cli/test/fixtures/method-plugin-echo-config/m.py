"""Fixture TranslationMethod that reports what the bridge handed it.

Used by cli/test/external-method.test.js. Each prediction is a JSON object
carrying the temperature the plugin received (repr, so None and 0.0 differ)
and the bridge's process id (so a test can tell whether two batches went
through the same Python process). No network, no model.
"""

from __future__ import annotations

import json
import os


class M:
    name = "echo-config-fixture"

    def __init__(self, manifest=None, method_dir=None):
        self.manifest = manifest
        self.method_dir = method_dir

    async def translate(self, entries, config):
        report = json.dumps({
            "temperature": repr(getattr(config, "temperature", "<missing>")),
            "pid": os.getpid(),
        })
        return [
            {
                "id": entry["id"],
                "predicted": f"{entry['source']}|{report}",
                "error": None,
                "usage": {"total_tokens": 0},
                "latency_s": 0.0,
            }
            for entry in entries
        ]
