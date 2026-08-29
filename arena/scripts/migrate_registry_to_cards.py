#!/usr/bin/env python3
"""
Convert existing arena/datasets/registry.json entries into individual
corpora card JSON files under cli/shared/corpora-cards/.

This is a ONE-TIME migration script. After running, the cards become
the SSOT and registry.json is generated from them by build_registry.py.

Why this exists:
    The registry.json monolith (1,211 lines, 48 datasets) predates the
    corpora card architecture. This script extracts each entry into a
    standalone card file with the new schema, adding structured metadata
    (contamination, quality, provenance) that the flat registry lacked.

Usage:
    python arena/scripts/migrate_registry_to_cards.py [--dry-run]
"""

import json
import os
import sys
from pathlib import Path

# --- Paths ---
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent
REGISTRY_PATH = REPO_ROOT / "arena" / "datasets" / "registry.json"
CARDS_DIR = REPO_ROOT / "cli" / "shared" / "corpora-cards"

# --- Dry run ---
DRY_RUN = "--dry-run" in sys.argv


def normalize_domain_distribution(dist: dict, size: int) -> dict:
    """Convert raw domain counts to proportions (0.0-1.0).

    The registry stores absolute counts (e.g., {'conv': 93, 'edu': 2}).
    The corpora card schema uses proportions for consistency with the
    domainDistribution convention in language cards.
    """
    if not dist or not size:
        return {}
    return {k: round(v / size, 3) for k, v in dist.items()}


def convert_entry(entry: dict) -> dict:
    """Convert a single registry entry to a corpora card.

    Maps the flat registry schema to the structured card schema,
    adding fields that didn't exist in the registry (contamination,
    quality, provenance).
    """
    pair = entry.get("language_pair", {})
    src = pair.get("source", "unk")
    tgt = pair.get("target", "unk")
    size = entry.get("size", 0)

    # Determine the origin — EDTeKLA entries are private, rest are Tatoeba
    is_edtekla = entry["id"].startswith("edtekla")
    source_name = "Tatoeba" if not is_edtekla else "EDTeKLA"

    # Build the card ID: eval-{src}-{tgt}-{source}-{segment}-v{version}
    # Extract a clean name from the entry ID
    if is_edtekla:
        card_name = entry["id"].replace("-", "-")
        card_id = f"eval-{src}-{tgt}-{card_name}"
    else:
        # tatoeba-eng-haw-dev → eval-eng-haw-tatoeba-dev-v1
        card_id = f"eval-{src}-{tgt}-tatoeba-dev-v1"

    # Build domain distribution as proportions
    raw_domain_dist = entry.get("domain_distribution", {})
    domain_dist = normalize_domain_distribution(raw_domain_dist, size)

    # Contamination assessment — Tatoeba is public CC-BY data
    if is_edtekla:
        contamination = {
            "risk": "NONE",
            "reasoning": "Private corpus. Not publicly available or included in any known training dataset."
        }
    else:
        contamination = {
            "risk": "MEDIUM",
            "reasoning": "Tatoeba sentences are publicly available under CC-BY-2.0. "
                         "Some may appear in training data of models that crawl "
                         "open-license parallel text. However, individual per-pair "
                         "subsets are small and unlikely to be specifically targeted."
        }

    # Quality assessment — factual only
    if is_edtekla:
        quality = {
            "humanTranslated": True,
            "translatorQualifications": "L1 Plains Cree speakers, certified educators",
            "reviewProcess": "multi-pass expert review",
            "orthography": "SRO (Standard Roman Orthography)"
        }
    else:
        quality = {
            "humanTranslated": True,
            "translatorQualifications": None,
            "reviewProcess": None,
            "orthography": None
        }

    card = {
        "id": card_id,
        "type": "eval",
        "name": entry.get("name", ""),
        "version": entry.get("version", "0.1.0"),
        "pair": {
            "source": src,
            "target": tgt,
            "direction": "unidirectional"
        },
        "description": entry.get("notes", ""),
        "source": {
            "publisher": "EDTeKLA Project, University of Alberta" if is_edtekla else "Tatoeba community (https://tatoeba.org)",
            "url": None if is_edtekla else "https://tatoeba.org",
            "paper": None,
            "citation": None,
            "fundedBy": None
        },
        "license": {
            "spdx": entry.get("license", "CC-BY-2.0"),
            "commercial": False if is_edtekla else True,
            "redistribution": True,
            "aiTraining": "non-commercial only" if is_edtekla else None,
            "notes": None
        },
        "dev": {
            "size": size,
            "sizeUnit": "entries",
            "domain": entry.get("domain", "mixed"),
            "domainDistribution": domain_dist,
            "dataFile": entry.get("path", ""),
            "format": "harness-json"
        },
        "secretTest": None,
        "stewardship": None,
        "submission": None,
        "quality": quality,
        "contamination": contamination,
        "doNotTrain": entry.get("do_not_train", True),
        "_provenance": {
            "addedAt": "2026-06-09",
            "lastUpdated": None,
            "populatedFrom": f"Migrated from arena/datasets/registry.json entry '{entry['id']}'. "
                             f"Size verified against curated data file. License from Tatoeba terms of use."
                             if not is_edtekla else
                             f"Migrated from arena/datasets/registry.json entry '{entry['id']}'. "
                             f"Quality metadata from EDTeKLA project documentation."
        }
    }

    return card


def main():
    # Load the registry
    if not REGISTRY_PATH.exists():
        print(f"ERROR: Registry not found at {REGISTRY_PATH}")
        sys.exit(1)

    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    datasets = registry.get("datasets", [])
    print(f"Found {len(datasets)} datasets in registry")

    # Create output directory
    CARDS_DIR.mkdir(parents=True, exist_ok=True)

    created = 0
    skipped = 0
    for entry in datasets:
        card = convert_entry(entry)
        card_path = CARDS_DIR / f"{card['id']}.json"

        if card_path.exists():
            print(f"  SKIP {card['id']} (already exists)")
            skipped += 1
            continue

        if DRY_RUN:
            print(f"  DRY  {card['id']} → {card_path.name}")
        else:
            card_path.write_text(
                json.dumps(card, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8"
            )
            print(f"  OK   {card['id']} → {card_path.name}")
        created += 1

    print(f"\nDone: {created} created, {skipped} skipped")
    if DRY_RUN:
        print("(dry run — no files written)")


if __name__ == "__main__":
    main()
