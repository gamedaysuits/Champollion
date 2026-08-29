#!/usr/bin/env python3
"""
Build Croissant ML 1.1 JSON-LD metadata from corpora cards.

Generates one .croissant.jsonld file per corpora card, providing
machine-readable dataset metadata in the MLCommons Croissant format.

What Croissant gives us:
    1. Google Dataset Search indexing (Croissant IS schema.org/Dataset)
    2. HuggingFace / Kaggle / OpenML interop (all support Croissant natively)
    3. Machine-readable usage policies via ODRL/DUO codes
    4. NeurIPS dataset submission compliance (Croissant required since 2024)

Why generate from cards:
    Cards are the SSOT for corpora metadata. This script reads each card
    and produces a Croissant JSON-LD file with the subset of fields that
    map to the Croissant schema. The card retains all governance detail;
    the Croissant file contains what external consumers need.

Usage:
    python arena/scripts/build_croissant.py              # build all
    python arena/scripts/build_croissant.py --dry-run     # preview
    python arena/scripts/build_croissant.py --card <id>   # build one card
    python arena/scripts/build_croissant.py --validate    # validate output
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# --- Paths ---
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent
CARDS_DIR = REPO_ROOT / "cli" / "shared" / "corpora-cards"
OUTPUT_DIR = REPO_ROOT / "arena" / "datasets" / "croissant"

# --- Flags ---
DRY_RUN = "--dry-run" in sys.argv
VALIDATE = "--validate" in sys.argv
SINGLE_CARD = None
if "--card" in sys.argv:
    card_idx = sys.argv.index("--card")
    if card_idx + 1 < len(sys.argv):
        SINGLE_CARD = sys.argv[card_idx + 1]


# --- SPDX to URL mapping ---
# Maps common SPDX identifiers to their canonical license URLs.
# This is what schema:license expects.
SPDX_URLS = {
    "CC-BY-2.0": "https://creativecommons.org/licenses/by/2.0/",
    "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
    "CC-BY-NC-4.0": "https://creativecommons.org/licenses/by-nc/4.0/",
    "CC-BY-NC-SA-4.0": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "MIT": "https://opensource.org/licenses/MIT",
    "Apache-2.0": "https://www.apache.org/licenses/LICENSE-2.0",
}

# --- DUO code mapping ---
# Maps usageRestrictions.training values to DUO (Data Use Ontology) codes.
# DUO is the standard vocabulary for expressing data use conditions
# in machine-readable form, originally from genomics/biobank governance.
TRAINING_TO_DUO = {
    "prohibited-by-license": {
        "code": "DUO_0000046",
        "name": "Non-Commercial Use Only",
        "description": "License terms prohibit use in ML training.",
    },
    "prohibited-by-community": {
        "code": "DUO_0000006",
        "name": "Health/Medical/Biomedical Research Only",
        # Closest DUO approximation: data restricted to specific use
        "description": "Community governance restricts use in ML training.",
    },
    "discouraged": {
        "code": "DUO_0000007",
        "name": "Disease-Specific Research Only",
        # No exact DUO match for 'discouraged'; we use the notes field
        "description": "Data custodians prefer this data not be used for training.",
    },
    "permitted": None,  # No restriction term needed
}


def card_to_croissant(card: dict) -> dict:
    """Convert a corpora card to a Croissant ML 1.1 JSON-LD document.

    Mapping follows the Croissant 1.1 specification:
    https://github.com/mlcommons/croissant/blob/main/docs/croissant-spec.md

    We map card fields to schema.org + Croissant properties, and express
    sovereignty/usage restrictions via DUO codes in schema:usageInfo.
    """
    card_id = card["id"]
    license_obj = card.get("license", {})
    source = card.get("source", {})
    dev = card.get("dev", {})
    pair = card.get("pair", {})
    usage = card.get("usageRestrictions") or {}
    sovereignty = card.get("sovereignty") or {}

    # Base Croissant document
    croissant = {
        "@context": {
            "@vocab": "https://schema.org/",
            "cr": "http://mlcommons.org/croissant/",
            "dct": "http://purl.org/dc/terms/",
            "odrl": "http://www.w3.org/ns/odrl/2/",
        },
        "@type": "Dataset",
        "dct:conformsTo": "http://mlcommons.org/croissant/1.1",
        "name": card["name"],
        "description": card.get("description", ""),
        "version": card.get("version", ""),
        "datePublished": card.get("_provenance", {}).get("addedAt", ""),
        "dateModified": card.get("_provenance", {}).get("lastUpdated", ""),
    }

    # License
    spdx = license_obj.get("spdx", "")
    if spdx in SPDX_URLS:
        croissant["license"] = SPDX_URLS[spdx]
    elif spdx:
        croissant["license"] = spdx

    # Source / provenance
    if source.get("url"):
        croissant["url"] = source["url"]
    if source.get("citation"):
        croissant["citation"] = source["citation"]
    if source.get("publisher"):
        croissant["creator"] = {
            "@type": "Organization",
            "name": source["publisher"],
        }

    # Language pair (as keywords for discoverability)
    keywords = []
    if pair.get("source"):
        keywords.append(f"source-language:{pair['source']}")
    if pair.get("target"):
        keywords.append(f"target-language:{pair['target']}")
    if card.get("type"):
        keywords.append(f"champollion:{card['type']}")
    if keywords:
        croissant["keywords"] = keywords

    # Distribution — the data files
    distributions = []
    if dev.get("dataFile"):
        distributions.append({
            "@type": "cr:FileObject",
            "@id": f"{card_id}-dev",
            "name": f"{card_id} development split",
            "contentUrl": dev["dataFile"],
            "encodingFormat": _format_to_mime(dev.get("format", "")),
        })

    # Public test split (if exists)
    test = card.get("test", {})
    if test.get("dataFile"):
        distributions.append({
            "@type": "cr:FileObject",
            "@id": f"{card_id}-test",
            "name": f"{card_id} public test split",
            "contentUrl": test["dataFile"],
            "encodingFormat": _format_to_mime(test.get("format", "")),
        })

    if distributions:
        croissant["distribution"] = distributions

    # RecordSet — describes the structure of the data
    if dev.get("size"):
        croissant["recordSet"] = [{
            "@type": "cr:RecordSet",
            "name": f"{card_id}-records",
            "description": f"{dev['size']} {dev.get('sizeUnit', 'entries')}",
            "field": [
                {
                    "@type": "cr:Field",
                    "name": "source",
                    "description": f"Source text ({pair.get('source', 'unk')})",
                    "dataType": "sc:Text",
                },
                {
                    "@type": "cr:Field",
                    "name": "reference",
                    "description": f"Reference translation ({pair.get('target', 'unk')})",
                    "dataType": "sc:Text",
                },
            ],
        }]

    # Usage info — DUO codes for training restrictions
    usage_info = []
    training = usage.get("training")
    if training and training in TRAINING_TO_DUO and TRAINING_TO_DUO[training]:
        duo = TRAINING_TO_DUO[training]
        usage_info.append({
            "@type": "DefinedTerm",
            "name": duo["name"],
            "termCode": duo["code"],
            "description": duo["description"],
            "inDefinedTermSet": "http://purl.obolibrary.org/obo/duo.owl",
        })

    # Community notes as additional usage info
    community_notes = usage.get("communityNotes")
    if community_notes:
        usage_info.append({
            "@type": "DefinedTerm",
            "name": "Community Guidance",
            "description": community_notes,
        })

    if usage_info:
        croissant["usageInfo"] = usage_info

    # Local Contexts TK Labels
    tk_labels = sovereignty.get("tkLabels", [])
    if tk_labels:
        croissant["subjectOf"] = [
            {
                "@type": "CreativeWork",
                "name": f"Local Contexts Label: {label['labelType']}",
                "url": label.get("url"),
                "description": f"Community-applied Traditional Knowledge / Biocultural Label (Local Contexts Hub project: {label.get('projectId', 'N/A')})",
            }
            for label in tk_labels
            if label.get("labelType")
        ]

    # Do Not Train flag
    if card.get("doNotTrain"):
        # Ensure this is prominently flagged
        if "usageInfo" not in croissant:
            croissant["usageInfo"] = []
        croissant["usageInfo"].insert(0, {
            "@type": "DefinedTerm",
            "name": "Evaluation Data — Do Not Train",
            "description": "This data is designated for evaluation purposes only. It must not be used for training ML models. Training on evaluation data is methodologically invalid.",
        })

    return croissant


def _format_to_mime(format_str: str) -> str:
    """Convert card data format to MIME type."""
    mapping = {
        "harness-json": "application/json",
        "jsonl": "application/jsonlines",
        "tsv": "text/tab-separated-values",
        "parallel-text": "text/plain",
    }
    return mapping.get(format_str, "application/octet-stream")


def main():
    if not CARDS_DIR.exists():
        print(f"ERROR: Cards directory not found: {CARDS_DIR}")
        sys.exit(1)

    # Load cards
    cards = []
    for card_path in sorted(CARDS_DIR.glob("*.json")):
        try:
            card = json.loads(card_path.read_text(encoding="utf-8"))
            # Filter to single card if specified
            if SINGLE_CARD and card.get("id") != SINGLE_CARD:
                continue
            cards.append(card)
        except (json.JSONDecodeError, KeyError) as e:
            print(f"  WARN Skipping {card_path.name}: {e}")

    if SINGLE_CARD and not cards:
        print(f"ERROR: Card '{SINGLE_CARD}' not found in {CARDS_DIR}")
        sys.exit(1)

    print(f"Processing {len(cards)} cards from {CARDS_DIR}")

    if DRY_RUN:
        for card in cards:
            croissant = card_to_croissant(card)
            print(f"  {card['id']}.croissant.jsonld — "
                  f"{len(json.dumps(croissant))} bytes, "
                  f"{len(croissant.get('distribution', []))} distributions, "
                  f"{len(croissant.get('usageInfo', []))} usage terms")
        print(f"\nWould write {len(cards)} files to {OUTPUT_DIR}")
        return

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Generate Croissant files
    for card in cards:
        croissant = card_to_croissant(card)
        output_path = OUTPUT_DIR / f"{card['id']}.croissant.jsonld"
        output_path.write_text(
            json.dumps(croissant, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    print(f"Wrote {len(cards)} Croissant files to {OUTPUT_DIR}")

    # Optional validation via mlcroissant library
    if VALIDATE:
        try:
            import mlcroissant  # noqa: F401
            print("\nValidating with mlcroissant...")
            errors = 0
            for card in cards:
                output_path = OUTPUT_DIR / f"{card['id']}.croissant.jsonld"
                try:
                    mlcroissant.Dataset(output_path)
                except Exception as e:
                    print(f"  FAIL: {card['id']}: {e}")
                    errors += 1
            if errors:
                print(f"{errors} validation errors")
                sys.exit(1)
            else:
                print("All files validate OK")
        except ImportError:
            print("\nmlcroissant not installed — skipping validation.")
            print("Install with: pip install mlcroissant")


if __name__ == "__main__":
    main()
