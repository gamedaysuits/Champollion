"""Import shim for the eval harness (mt-eval).

forge implements ZERO metrics (mistake #10 in the requirements ledger: a
bespoke evaluator partially re-implemented scoring and drifted). All scoring
delegates to ``mt_eval_harness``:

- point scores + bootstrap CIs: ``mt_eval_harness.confidence``
- A/B significance:             ``mt_eval_harness.significance``

Resolution order:
1. an installed ``mt-eval`` distribution;
2. ``$MT_EVAL_HARNESS_PATH`` (a checkout containing ``mt_eval_harness/``);
3. monorepo fallback: the sibling ``arena/`` directory (forge lives at
   ``<repo>/forge/``, the harness at ``<repo>/arena/mt_eval_harness/``).

Fails loud with install instructions — never a silent no-scores path.
"""

from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path


def _candidate_paths() -> list[Path]:
    cands = []
    env = os.environ.get("MT_EVAL_HARNESS_PATH")
    if env:
        cands.append(Path(env))
    # <repo>/forge/nmt_forge/_harness.py → <repo>/arena
    cands.append(Path(__file__).resolve().parents[2] / "arena")
    return cands


def load_harness():
    """Import and return the ``mt_eval_harness`` package, or raise ForgeError."""
    try:
        return importlib.import_module("mt_eval_harness")
    except ImportError:
        pass
    for cand in _candidate_paths():
        if (cand / "mt_eval_harness" / "__init__.py").is_file():
            if str(cand) not in sys.path:
                sys.path.insert(0, str(cand))
            try:
                return importlib.import_module("mt_eval_harness")
            except ImportError:
                continue
    from .errors import ForgeError

    raise ForgeError(
        "mt-eval is not importable — forge delegates ALL scoring to it "
        "and has no fallback scorer by design.\n"
        "  fix: `pip install mt-eval-harness` (once published), or point "
        "MT_EVAL_HARNESS_PATH at a checkout of the arena/ package, or run "
        "from the Champollion monorepo where arena/ is a sibling of forge/."
    )


def confidence():
    load_harness()
    return importlib.import_module("mt_eval_harness.confidence")


def significance():
    load_harness()
    return importlib.import_module("mt_eval_harness.significance")


def language_cards_mod():
    """The harness's language_cards module (the ONE Python card adapter)."""
    load_harness()
    return importlib.import_module("mt_eval_harness.language_cards")
