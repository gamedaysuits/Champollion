"""CLI glue for ``nmt-forge synth``."""

from __future__ import annotations

import json

from .engine import SynthesisEngine
from .packs import load_pack


def synthesize_cli(args) -> int:
    pack = load_pack(args.pack)
    engine = SynthesisEngine(pack, seed=args.seed)
    manifest = engine.run(args.out, limit_per_kind=args.limit)
    print(json.dumps(manifest, indent=2, ensure_ascii=False))
    return 0
