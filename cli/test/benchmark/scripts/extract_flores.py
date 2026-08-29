#!/usr/bin/env python3
"""
extract_flores.py — Download FLORES+ devtest and extract fixtures for champollion benchmark.

Requires:
    pip install datasets huggingface_hub

Usage:
    # First time: will prompt for HuggingFace token
    python extract_flores.py

    # With token from env
    HF_TOKEN=hf_xxxxx python extract_flores.py

Produces:
    test/benchmark/fixtures/flores-devtest.en.json     (English source)
    test/benchmark/fixtures/flores-devtest.{lang}.json  (39 reference files)
    test/benchmark/fixtures/flores-metadata.json        (sentence metadata)

Each fixture file is a JSON array of 1,012 objects:
    [{ "id": "1", "text": "..." }, { "id": "2", "text": "..." }, ...]

The metadata file contains per-sentence info (domain, topic, word count)
for downstream RQ5 analysis (short/medium/long categorization).
"""

import json
import os
import sys

# ---------------------------------------------------------------------------
# FLORES+ language code → champollion code mapping
#
# FLORES+ uses ISO 639-3 + ISO 15924 combos (e.g. "fra_Latn").
# champollion uses IETF BCP 47 tags (e.g. "fr").
# This mapping connects the two systems.
# ---------------------------------------------------------------------------
FLORES_TO_CHAMPOLLION = {
    # --- English source ---
    "eng_Latn": "en",

    # --- Priority languages ---
    "arb_Arab": "ar",       # Modern Standard Arabic
    "fil_Latn": "tl",       # Filipino / Tagalog — FLORES uses 'fil' (ISO 639-3)
    "fra_Latn": "fr",       # French
    "spa_Latn": "es",       # Spanish (also used for es-MX reference)
    "deu_Latn": "de",       # German
    "jpn_Jpan": "ja",       # Japanese
    "cmn_Hans": "zh",       # Chinese Simplified — FLORES uses 'cmn' (Mandarin)
    "ita_Latn": "it",       # Italian
    "por_Latn": "pt",       # Brazilian Portuguese
    "kor_Hang": "ko",       # Korean

    # --- Major world languages ---
    "ben_Beng": "bn",       # Bengali
    "bul_Cyrl": "bg",       # Bulgarian
    "ces_Latn": "cs",       # Czech
    "dan_Latn": "da",       # Danish
    "ell_Grek": "el",       # Greek
    "pes_Arab": "fa",       # Persian (Farsi) — FLORES uses 'pes' for Western Persian
    "fin_Latn": "fi",       # Finnish
    "heb_Hebr": "he",       # Hebrew
    "hin_Deva": "hi",       # Hindi
    "hun_Latn": "hu",       # Hungarian
    "ind_Latn": "id",       # Indonesian
    "zsm_Latn": "ms",       # Malay — FLORES uses 'zsm' (Standard Malay)
    "nld_Latn": "nl",       # Dutch
    "nob_Latn": "no",       # Norwegian Bokmål
    "pol_Latn": "pl",       # Polish
    "por_Latn__PT": "pt-PT", # European Portuguese — FLORES may not distinguish; using same ref
    "ron_Latn": "ro",       # Romanian
    "rus_Cyrl": "ru",       # Russian
    "slk_Latn": "sk",       # Slovak
    "swe_Latn": "sv",       # Swedish
    "swh_Latn": "sw",       # Swahili
    "tha_Thai": "th",       # Thai
    "tur_Latn": "tr",       # Turkish
    "ukr_Cyrl": "uk",       # Ukrainian
    "urd_Arab": "ur",       # Urdu
    "vie_Latn": "vi",       # Vietnamese
    "cmn_Hant": "zh-TW",    # Chinese Traditional — FLORES uses 'cmn' (Mandarin)

    # --- Regional variants (use base language reference) ---
    # es-MX: uses spa_Latn reference (same FLORES data, register steers dialect)
    # fr-CA: uses fra_Latn reference (same FLORES data, register steers dialect)
}

# Special cases: regional variants that share a FLORES reference with their parent
REGIONAL_ALIASES = {
    "es-MX": "es",   # Mexican Spanish uses same FLORES ref as Spanish
    "fr-CA": "fr",   # Canadian French uses same FLORES ref as French
    "pt-PT": "pt",   # European Portuguese uses same FLORES ref as Brazilian Portuguese
}


def extract_language(flores_code, champollion_code, output_dir):
    """
    Download and extract a single FLORES+ language's devtest split.

    Returns the number of sentences extracted, or 0 on failure.
    """
    from datasets import load_dataset

    # Handle the special pt-PT case — use por_Latn
    actual_flores = flores_code.replace("__PT", "")

    try:
        ds = load_dataset(
            "openlanguagedata/flores_plus",
            actual_flores,
            split="devtest",
        )
    except Exception as e:
        print(f"  ✗ Failed to load {actual_flores} → {champollion_code}: {e}")
        return 0

    sentences = []
    for row in ds:
        sentences.append({
            "id": str(row["id"]),
            "text": row["text"],
        })

    # Sort by ID to ensure consistent ordering across languages
    sentences.sort(key=lambda x: int(x["id"]))

    output_path = os.path.join(output_dir, f"flores-devtest.{champollion_code}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(sentences, f, ensure_ascii=False, indent=2)

    return len(sentences)


def extract_metadata(output_dir):
    """
    Extract sentence metadata from English source for RQ5 categorization.

    Categorizes each sentence as short/medium/long based on word count:
      - short:  ≤10 words  (approximates button labels, CTAs)
      - medium: 11–25 words (approximates tooltips, descriptions)
      - long:   26+ words   (approximates help text, documentation)
    """
    en_path = os.path.join(output_dir, "flores-devtest.en.json")
    with open(en_path, "r", encoding="utf-8") as f:
        sentences = json.load(f)

    metadata = []
    for s in sentences:
        word_count = len(s["text"].split())
        if word_count <= 10:
            category = "short"
        elif word_count <= 25:
            category = "medium"
        else:
            category = "long"

        metadata.append({
            "id": s["id"],
            "word_count": word_count,
            "category": category,
        })

    # Summary stats
    counts = {"short": 0, "medium": 0, "long": 0}
    for m in metadata:
        counts[m["category"]] += 1

    meta_output = {
        "total_sentences": len(metadata),
        "category_counts": counts,
        "sentences": metadata,
    }

    output_path = os.path.join(output_dir, "flores-metadata.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(meta_output, f, ensure_ascii=False, indent=2)

    return counts


def main():
    # Resolve output directory relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, "..", "fixtures")
    os.makedirs(output_dir, exist_ok=True)

    # Check for HuggingFace authentication
    token = os.environ.get("HF_TOKEN")
    if token:
        import huggingface_hub
        huggingface_hub.login(token=token)
        print("✓ Authenticated with HF_TOKEN from environment")
    else:
        try:
            import huggingface_hub
            user_info = huggingface_hub.whoami()
            print(f"✓ Already authenticated as: {user_info.get('name', 'unknown')}")
        except Exception:
            print("⚠ Not authenticated. Run `huggingface-cli login` first, or set HF_TOKEN.")
            print("  You must also accept the FLORES+ terms at:")
            print("  https://huggingface.co/datasets/openlanguagedata/flores_plus")
            sys.exit(1)

    # -----------------------------------------------------------------------
    # Step 1: Extract English source + all 39 language references
    # -----------------------------------------------------------------------
    print("\n--- Extracting FLORES+ devtest (1,012 sentences × 40 languages) ---\n")

    results = {}
    total_languages = len(FLORES_TO_CHAMPOLLION)

    for i, (flores_code, champollion_code) in enumerate(FLORES_TO_CHAMPOLLION.items(), 1):
        print(f"  [{i}/{total_languages}] {flores_code} → {champollion_code} ... ", end="", flush=True)
        count = extract_language(flores_code, champollion_code, output_dir)
        if count > 0:
            print(f"✓ {count} sentences")
            results[champollion_code] = count
        else:
            print("✗ FAILED")
            results[champollion_code] = 0

    # -----------------------------------------------------------------------
    # Step 2: Create regional variant aliases (symlink-like copies)
    # -----------------------------------------------------------------------
    print("\n--- Creating regional variant references ---\n")

    for variant_code, parent_code in REGIONAL_ALIASES.items():
        parent_file = os.path.join(output_dir, f"flores-devtest.{parent_code}.json")
        variant_file = os.path.join(output_dir, f"flores-devtest.{variant_code}.json")

        if os.path.exists(parent_file) and not os.path.exists(variant_file):
            # Copy the parent's reference file for the variant
            # (The variant will be scored against the same reference — acknowledged as a limitation)
            import shutil
            shutil.copy2(parent_file, variant_file)
            print(f"  {variant_code} → copied from {parent_code}")
            results[variant_code] = results.get(parent_code, 0)
        elif os.path.exists(variant_file):
            print(f"  {variant_code} → already exists")
        else:
            print(f"  {variant_code} → ✗ parent {parent_code} not found!")

    # -----------------------------------------------------------------------
    # Step 3: Generate sentence metadata for RQ5 analysis
    # -----------------------------------------------------------------------
    print("\n--- Generating sentence metadata ---\n")

    if results.get("en", 0) > 0:
        counts = extract_metadata(output_dir)
        print(f"  Category distribution:")
        print(f"    Short  (≤10 words): {counts['short']}")
        print(f"    Medium (11–25):     {counts['medium']}")
        print(f"    Long   (26+):       {counts['long']}")

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print("\n--- Summary ---\n")

    successful = sum(1 for v in results.values() if v > 0)
    failed = sum(1 for v in results.values() if v == 0)

    print(f"  Languages extracted: {successful}")
    print(f"  Languages failed:    {failed}")
    print(f"  Output directory:    {os.path.abspath(output_dir)}")

    if failed > 0:
        failed_langs = [k for k, v in results.items() if v == 0]
        print(f"\n  ⚠ Failed languages: {', '.join(failed_langs)}")
        print("  Check FLORES+ language codes at:")
        print("  https://huggingface.co/datasets/openlanguagedata/flores_plus")

    print("\nDone.")


if __name__ == "__main__":
    main()
