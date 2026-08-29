"""
Method Card Wizard — Interactive CLI wizard for creating method cards.

Triggered during 'mt-eval publish' when no --method-card is provided
and auto_confirm is False. Walks the user through defining their
method's metadata for reproducibility and attribution.

A method card is the identity document of an evaluation run. It answers:
    "What method produced these translations?"

The wizard produces a dict that matches the method.json manifest format,
making it compatible with both inline publish metadata and standalone
method plugin directories.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


# Default method classes — presented as a numbered menu.
# These MUST be a subset of config.VALID_METHOD_CLASSES (pinned by
# tests/test_method_card_wizard_vocab.py): the wizard once offered
# "fine-tuned", which no validator accepts, so a card created through the
# menu could fail at use time. A fine-tuned model is classed by how it is
# SERVED: custom-plugin when it runs as a harness method plugin, api when it
# sits behind a translation endpoint; its training story belongs in
# `paradigm` and the card notes.
METHOD_CLASSES = [
    ("raw-llm", "Raw LLM — Direct API call, minimal instruction"),
    ("coached-llm", "Coached LLM — LLM with coaching prompt / few-shot"),
    ("pipeline", "Pipeline — Multi-stage processing (decomp-recomp, etc.)"),
    ("api", "API — External translation service (Google, DeepL, etc.)"),
    ("custom-plugin", "Custom plugin — your own method behind the harness plugin port (incl. fine-tuned models you serve yourself)"),
    ("human", "Human — Human translation baseline"),
]

# Translation paradigms — the algorithmic "how" axis, ORTHOGONAL to method
# class. Mirrors config.VALID_PARADIGMS. This is what makes rule-based vs
# neural vs LLM comparable on the leaderboard (an Apertium pipeline and Google
# Translate share a class but differ here). Defaults to "unknown" if skipped.
PARADIGMS = [
    ("rule-based", "Rule-based — FST / grammar / morphological rules (e.g. Apertium)"),
    ("statistical", "Statistical — phrase-based SMT (e.g. classic Moses)"),
    ("neural-nmt", "Neural NMT — dedicated encoder-decoder MT (e.g. Google, OPUS-MT)"),
    ("llm", "LLM — general-purpose large language model"),
    ("hybrid", "Hybrid — combines paradigms (e.g. LLM + FST validation)"),
    ("human", "Human — human translation baseline"),
    ("unknown", "Unknown / unspecified"),
]


def _slugify(name: str) -> str:
    """Convert a method name to a kebab-case slug.

    Example: 'CRK Coached v8.2' → 'crk-coached-v8-2'
    """
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def run_wizard(submitter: str = "") -> dict | None:
    """Run the interactive method card wizard.

    Args:
        submitter: Pre-filled author name (from OAuth identity).

    Returns:
        Method card dict, or None if the user cancels.
    """
    print("\n" + "─" * 50)
    print("  Method Card Wizard")
    print("  A method card identifies what produced your translations.")
    print("─" * 50)

    # --- Method name ---
    print("\n  1. Method Name")
    print("     Examples: 'GPT-4o Naive', 'CRK Coached v8.2',")
    print("               'DeepL API', 'Decomp-Recomp Pipeline'")
    name = input("\n     Name: ").strip()
    if not name:
        print("     Cancelled (no name provided).")
        return None

    # --- Method ID ---
    default_id = _slugify(name)
    print(f"\n  2. Method ID (kebab-case, used as unique identifier)")
    method_id = input(f"     ID [{default_id}]: ").strip() or default_id

    # --- Method class ---
    print("\n  3. Method Class")
    for i, (class_id, description) in enumerate(METHOD_CLASSES, 1):
        print(f"     {i}. {description}")

    class_input = input("\n     Class [1]: ").strip() or "1"
    try:
        class_idx = int(class_input) - 1
        if 0 <= class_idx < len(METHOD_CLASSES):
            method_class = METHOD_CLASSES[class_idx][0]
        else:
            method_class = "raw-llm"
    except ValueError:
        # Allow freeform class input (e.g., "custom-type")
        method_class = class_input

    # --- Paradigm (orthogonal to class) ---
    print("\n  4. Translation Paradigm")
    print("     The algorithmic approach — independent of method class. Lets the")
    print("     leaderboard compare rule-based vs neural vs LLM apples-to-apples.")
    for i, (paradigm_id, description) in enumerate(PARADIGMS, 1):
        print(f"     {i}. {description}")

    default_paradigm_idx = len(PARADIGMS)  # "unknown" is the last option
    paradigm_input = (
        input(f"\n     Paradigm [{default_paradigm_idx}]: ").strip()
        or str(default_paradigm_idx)
    )
    try:
        paradigm_idx = int(paradigm_input) - 1
        if 0 <= paradigm_idx < len(PARADIGMS):
            paradigm = PARADIGMS[paradigm_idx][0]
        else:
            paradigm = "unknown"
    except ValueError:
        # Allow freeform paradigm input (validated downstream against
        # config.VALID_PARADIGMS).
        paradigm = paradigm_input

    # --- Author ---
    print(f"\n  5. Author")
    author = input(f"     Author [{submitter or 'anonymous'}]: ").strip()
    if not author:
        author = submitter or "anonymous"

    # --- Description ---
    print(f"\n  6. Description (optional, press Enter to skip)")
    description = input("     Description: ").strip()

    # --- Build the card ---
    card = {
        "name": name,
        "method_id": method_id,
        "class": method_class,
        "paradigm": paradigm,
        "author": author,
    }
    if description:
        card["description"] = description

    # --- Preview ---
    print("\n" + "─" * 50)
    print("  Method Card Preview:")
    for key, value in card.items():
        print(f"    {key}: {value}")
    print("─" * 50)

    # --- Confirm ---
    confirm = input("\n  Use this method card? [Y/n] ").strip().lower()
    if confirm and confirm != "y":
        print("  Cancelled.")
        return None

    # --- Offer to save ---
    save = input("  Save to method_card.json for reuse? [y/N] ").strip().lower()
    if save == "y":
        save_path = Path("method_card.json")
        save_path.write_text(
            json.dumps(card, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"  Saved to {save_path.resolve()}")
        print(f"  Reuse with: mt-eval publish --method-card {save_path}")

    return card
