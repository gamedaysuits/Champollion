#!/usr/bin/env python3
"""
ONE-OFF migration: fix the GlobalVoices contamination key shape.

The 493 ``eval-*-globalvoices-test-v1`` corpora cards were emitted by an
older ``build_all_globalvoices.py`` that wrote ``contamination`` as
``{"level": ..., "notes": ...}``. The canonical shape used by every other
builder, by the corpora-card schema (``risk``/``reasoning``, with
``additionalProperties: false``), and by card-level readers that look up
``contamination.risk`` is ``{"risk": ..., "reasoning": ...}``.

Because the keys were wrong, ``contamination.risk`` read back as ``None``
on all 493 cards (and the cards were technically schema-invalid). The
builder is fixed going forward; this script repairs the cards already on
disk by renaming the keys in place — VALUES ARE PRESERVED VERBATIM
(``level`` → ``risk``, ``notes`` → ``reasoning``).

It is idempotent (cards already on the canonical shape are skipped) and
only touches the ``contamination`` block — the file is re-serialized with
the same formatter the builder uses (``indent=2``, ``ensure_ascii=False``,
trailing newline), so the diff is limited to the two renamed keys.

Usage (from the repo root):
    python3 arena/scripts/migrate_globalvoices_contamination_key.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
CARDS_DIR = REPO_ROOT / "cli" / "shared" / "corpora-cards"

#: Glob for the cards this migration repairs.
CARD_GLOB = "*globalvoices*.json"

#: Old → new key names inside the ``contamination`` block.
KEY_RENAMES = {"level": "risk", "notes": "reasoning"}


def migrate_contamination(contamination: dict) -> tuple[dict, bool]:
    """Return (new_contamination, changed).

    Renames ``level`` → ``risk`` and ``notes`` → ``reasoning`` while
    preserving insertion order and any other keys (e.g.
    ``knownInTrainingOf``). A new key never clobbers an existing one: if
    a card already carries ``risk``, the legacy ``level`` is dropped
    rather than overwriting it.
    """
    changed = False
    out: dict = {}
    for key, value in contamination.items():
        new_key = KEY_RENAMES.get(key, key)
        if new_key != key:
            changed = True
            if new_key in contamination:
                # Canonical key already present — drop the legacy alias.
                continue
        out[new_key] = value
    return out, changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Report what would change without writing.",
    )
    args = parser.parse_args()

    if not CARDS_DIR.is_dir():
        print(f"ERROR: cards directory not found: {CARDS_DIR}", file=sys.stderr)
        return 1

    files = sorted(CARDS_DIR.glob(CARD_GLOB))
    if not files:
        print(f"No cards matched {CARDS_DIR}/{CARD_GLOB} — nothing to do.")
        return 0

    migrated = 0
    already_ok = 0
    for path in files:
        card = json.loads(path.read_text(encoding="utf-8"))
        contamination = card.get("contamination")
        if not isinstance(contamination, dict):
            continue
        new_contamination, changed = migrate_contamination(contamination)
        if not changed:
            already_ok += 1
            continue
        card["contamination"] = new_contamination
        migrated += 1
        if args.dry_run:
            print(f"  would migrate {path.name}: "
                  f"{list(contamination)} -> {list(new_contamination)}")
            continue
        # Same formatter the builder uses, so only the renamed keys diff.
        path.write_text(
            json.dumps(card, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    verb = "Would migrate" if args.dry_run else "Migrated"
    print()
    print(f"{verb}: {migrated}")
    print(f"Already canonical (skipped): {already_ok}")
    print(f"Total cards scanned: {len(files)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
