#!/usr/bin/env python3
"""Run the top of the community-compute queue with your own API key.

Thin wrapper around ``mt_eval_harness.queue_runner`` so the runner
works without an installed harness entry point:

    python3 scripts/run_queue.py --top 5
    python3 scripts/run_queue.py --budget 2.50
    python3 scripts/run_queue.py --top 3 --dry-run

The installed equivalent is ``mt-eval queue`` — same flags, same
behavior (one implementation; see queue_runner's docstring for the
selection and safety rules).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Runnable from a checkout without installation: arena/ is the parent.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mt_eval_harness.queue_runner import (  # noqa: E402
    COACHING_PLACEHOLDER,
    DEFAULT_QUEUE_URL,
    add_queue_arguments,
    load_queue,
    run_from_args,
    select_items,
)

__all__ = [
    "COACHING_PLACEHOLDER",
    "DEFAULT_QUEUE_URL",
    "load_queue",
    "select_items",
]


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    add_queue_arguments(parser)
    return run_from_args(parser.parse_args())


if __name__ == "__main__":
    sys.exit(main())
