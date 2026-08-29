"""Minimal TranslationMethod fixture for the cross-runtime loader parity test.

This one directory is loaded by BOTH method loaders:
  - arena/mt_eval_harness/method_loader.py  (load_method)
  - cli/lib/bridge/method_bridge.py         (its self-contained reimplementation)

method_bridge.py is a hand-synced copy of method_loader.py, guarded only by a
comment. The parity tests (arena/tests/test_method_bridge_parity.py and
cli/test/method-bridge-parity.test.js) point both loaders at this fixture and
assert each loads it and runs a translate round-trip.

method.json carries EXACTLY the fields both loaders require — name and
entry_point — and nothing else. That is deliberate: if a required field is
added to only one loader's _REQUIRED_MANIFEST_FIELDS, this fixture (which lacks
it) will fail to load on that side and pass on the other, surfacing the drift.

The method is a passthrough (returns the source text unchanged) so the round-trip
needs no network or model.
"""

from __future__ import annotations


class M:
    name = "parity-fixture"

    def __init__(self, manifest=None, method_dir=None):
        # Exercises the loaders' primary instantiation path, which passes
        # manifest= and method_dir= keyword arguments.
        self.manifest = manifest
        self.method_dir = method_dir

    async def translate(self, entries, config):
        # The bridge sends entries shaped {"id", "source"}; a real harness
        # RunConfig carries a source_field (default "source"). Read whichever
        # applies so the same passthrough works through both runtimes.
        field = getattr(config, "source_field", None) or "source"
        results = []
        for entry in entries:
            results.append({
                "id": entry["id"],
                "predicted": entry.get(field, entry.get("source", "")),
                "error": None,
                "usage": {"total_tokens": 0},
                "latency_s": 0.0,
            })
        return results
