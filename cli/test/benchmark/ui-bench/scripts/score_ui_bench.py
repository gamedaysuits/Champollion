#!/usr/bin/env python3
"""
score_ui_bench.py — Evaluation pipeline for champollion-bench UI results.

Computes:
  1. chrF++ — Character n-gram F-score (sacrebleu). Good for short UI strings
     where word-level BLEU fails.
  2. Placeholder preservation — Did {variable}, {{name}}, %s survive?
  3. JSON structural integrity — All keys present? No extra keys?
  4. Length ratio analysis — Button translations concise? Descriptions natural?
  5. Instruction leakage — Does the translation contain meta-text?
  6. Untranslated rate — Strings returned identical to source.

Usage:
  python3 test/benchmark/ui-bench/scripts/score_ui_bench.py [--results-dir PATH]

Output:
  test/benchmark/ui-bench/results/scores/{model}/{condition}/scores.json
  test/benchmark/ui-bench/results/scores/summary.json
"""

import json
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

UI_BENCH_DIR = Path(__file__).resolve().parent.parent
RESULTS_DIR = UI_BENCH_DIR / "results"
SCORES_DIR = RESULTS_DIR / "scores"
SOURCE_DIR = UI_BENCH_DIR / "source"
REFERENCE_DIR = UI_BENCH_DIR / "reference"
METADATA_PATH = UI_BENCH_DIR / "metadata.json"

# ---------------------------------------------------------------------------
# chrF++ scoring
# ---------------------------------------------------------------------------

def compute_chrf(hypotheses: list[str], references: list[str]) -> dict:
    """
    Compute chrF++ score using sacrebleu.

    WHY chrF++ over BLEU for UI strings:
      - UI strings are often 1-5 words. BLEU needs 4-grams which barely exist.
      - chrF++ operates at the character level, which is better for:
        * Agglutinative languages (Korean, Japanese, Finnish)
        * Character-dense scripts (Chinese, Japanese)
        * Short strings where word-level n-grams are sparse
    """
    try:
        import sacrebleu
        chrf = sacrebleu.corpus_chrf(
            hypotheses,
            [references],
            char_order=6,
            word_order=2,  # chrF++ (with word n-grams)
            beta=2,
        )
        return {
            "score": round(chrf.score, 2),
            "char_order": 6,
            "word_order": 2,
            "beta": 2,
        }
    except ImportError:
        print("⚠ sacrebleu not installed. Run: pip install sacrebleu", file=sys.stderr)
        return {"score": None, "error": "sacrebleu not installed"}

# ---------------------------------------------------------------------------
# Placeholder preservation audit
# ---------------------------------------------------------------------------

# Patterns for common placeholder formats in UI strings
PLACEHOLDER_PATTERNS = [
    re.compile(r"\{[^}]+\}"),        # ICU: {name}, {count, plural, ...}
    re.compile(r"\{\{[^}]+\}\}"),    # Mustache: {{name}}
    re.compile(r"%[sd]"),            # printf: %s, %d
    re.compile(r"%\d+\$[sd]"),       # positional printf: %1$s
    re.compile(r"\$[^$]+\$"),        # Custom: $name$
]


def extract_placeholders(text: str) -> set[str]:
    """Extract all placeholders from a string."""
    found = set()
    for pattern in PLACEHOLDER_PATTERNS:
        found.update(pattern.findall(text))
    return found


def audit_placeholder_preservation(source: str, translation: str) -> dict:
    """
    Check whether all placeholders in the source survive in the translation.

    Returns:
      preserved: bool — all source placeholders found in translation
      source_placeholders: list of placeholders found in source
      missing: list of placeholders missing from translation
      added: list of placeholders in translation but not in source
    """
    src_ph = extract_placeholders(source)
    tgt_ph = extract_placeholders(translation)

    missing = src_ph - tgt_ph
    added = tgt_ph - src_ph

    return {
        "preserved": len(missing) == 0,
        "source_placeholders": sorted(src_ph),
        "missing": sorted(missing),
        "added": sorted(added),
    }

# ---------------------------------------------------------------------------
# Instruction leakage detection
# ---------------------------------------------------------------------------

# Phrases that indicate the model leaked its instructions into the output
LEAKAGE_PATTERNS = [
    re.compile(r"^(?:Here (?:is|are)|Note:|Translation:|Translated|I (?:have|'ve) translated)", re.I),
    re.compile(r"(?:markdown|JSON|json|fences)", re.I),
    re.compile(r"^(?:Sure|Of course|Certainly)[,!.]", re.I),
]


def detect_instruction_leakage(text: str) -> bool:
    """Check if a translated string contains instruction leakage."""
    for pattern in LEAKAGE_PATTERNS:
        if pattern.search(text):
            return True
    return False

# ---------------------------------------------------------------------------
# Length ratio analysis
# ---------------------------------------------------------------------------

def compute_length_ratio(source: str, translation: str) -> float:
    """
    Compute the character-length ratio of translation to source.

    Useful for detecting:
      - Over-translation: ratio >> 1.5 (model added explanation)
      - Under-translation: ratio << 0.5 (model truncated)
      - Untranslated: ratio ~1.0 AND strings are identical
    """
    if len(source) == 0:
        return 0.0
    return round(len(translation) / len(source), 3)

# ---------------------------------------------------------------------------
# Core scoring logic
# ---------------------------------------------------------------------------

def score_one_result(result_path: Path, source: dict, reference: dict, metadata: dict) -> dict:
    """
    Score a single result file (one model × one condition × one language).

    Returns a comprehensive score document with all metrics.
    """
    with open(result_path) as f:
        result = json.load(f)

    translations = result.get("translations", {})
    stats = result.get("stats", {})

    # Align translations with references
    hypotheses = []
    references_list = []
    keys_scored = []

    # Per-string audits
    placeholder_results = []
    length_ratios = []
    leakage_count = 0
    untranslated_count = 0
    missing_keys = []
    extra_keys = []

    # Score only keys that exist in both translation output AND reference
    ref_keys = set(reference.keys())
    trans_keys = set(translations.keys())

    for key in sorted(ref_keys):
        if key in translations:
            hyp = str(translations[key])
            ref = str(reference[key])
            src = str(source.get(key, ""))

            hypotheses.append(hyp)
            references_list.append(ref)
            keys_scored.append(key)

            # Placeholder audit
            if src:
                ph_result = audit_placeholder_preservation(src, hyp)
                placeholder_results.append(ph_result)

            # Length ratio
            if src:
                length_ratios.append(compute_length_ratio(src, hyp))

            # Instruction leakage
            if detect_instruction_leakage(hyp):
                leakage_count += 1

            # Untranslated check
            if hyp == src and len(src) > 3:
                untranslated_count += 1
        else:
            missing_keys.append(key)

    # Extra keys (in translation but not in reference)
    extra_keys = sorted(trans_keys - ref_keys)

    # Compute chrF++
    chrf_score = compute_chrf(hypotheses, references_list) if hypotheses else {"score": None}

    # Aggregate placeholder stats
    total_with_placeholders = sum(1 for p in placeholder_results if p["source_placeholders"])
    preserved_count = sum(1 for p in placeholder_results if p["source_placeholders"] and p["preserved"])

    # Aggregate length ratios by key type
    length_by_type = {}
    for key, ratio in zip(keys_scored, length_ratios):
        meta = metadata.get("strings", {}).get(key, {})
        key_type = meta.get("type", "unknown")
        if key_type not in length_by_type:
            length_by_type[key_type] = []
        length_by_type[key_type].append(ratio)

    # Compute mean length ratio per type
    length_means = {}
    for key_type, ratios in length_by_type.items():
        length_means[key_type] = round(sum(ratios) / len(ratios), 3) if ratios else 0

    return {
        "model": result.get("model"),
        "condition": result.get("condition"),
        "language": result.get("language"),
        "dataset": "ui-bench",
        "timestamp": result.get("timestamp"),
        "metrics": {
            "chrf_plus_plus": chrf_score,
            "strings_scored": len(hypotheses),
            "strings_missing": len(missing_keys),
            "strings_extra": len(extra_keys),
            "untranslated_count": untranslated_count,
            "untranslated_rate": round(untranslated_count / max(len(hypotheses), 1) * 100, 2),
            "instruction_leakage_count": leakage_count,
            "instruction_leakage_rate": round(leakage_count / max(len(hypotheses), 1) * 100, 2),
        },
        "placeholder_audit": {
            "total_with_placeholders": total_with_placeholders,
            "preserved_count": preserved_count,
            "preservation_rate": round(preserved_count / max(total_with_placeholders, 1) * 100, 2),
        },
        "length_analysis": {
            "mean_ratio_by_type": length_means,
            "overall_mean_ratio": round(sum(length_ratios) / max(len(length_ratios), 1), 3),
        },
        "cost": stats.get("costUSD", 0),
    }

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Load source and metadata
    source_path = SOURCE_DIR / "en.json"
    if not source_path.exists():
        print("❌ Source strings not found. Run extract_ui_strings.js first.")
        sys.exit(1)

    with open(source_path) as f:
        source = json.load(f)

    metadata = {}
    if METADATA_PATH.exists():
        with open(METADATA_PATH) as f:
            metadata = json.load(f)

    # Find all result files
    raw_dir = RESULTS_DIR / "raw"
    if not raw_dir.exists():
        print("❌ No results found. Run run-ui-bench.js first.")
        sys.exit(1)

    all_scores = []
    summary_by_condition = {}

    for model_dir in sorted(raw_dir.iterdir()):
        if not model_dir.is_dir():
            continue
        model_name = model_dir.name

        for condition_dir in sorted(model_dir.iterdir()):
            if not condition_dir.is_dir():
                continue
            condition = condition_dir.name

            for lang_file in sorted(condition_dir.glob("*.json")):
                lang_code = lang_file.stem

                # Load reference
                ref_path = REFERENCE_DIR / f"{lang_code}.json"
                if not ref_path.exists():
                    print(f"  ⚠ No reference for {lang_code}, skipping")
                    continue

                with open(ref_path) as f:
                    reference = json.load(f)

                print(f"  Scoring: {model_name} / {condition} / {lang_code}...", end=" ")
                scores = score_one_result(lang_file, source, reference, metadata)
                all_scores.append(scores)

                chrf = scores["metrics"]["chrf_plus_plus"].get("score", "N/A")
                ph_rate = scores["placeholder_audit"]["preservation_rate"]
                print(f"chrF++={chrf}  placeholders={ph_rate}%")

                # Save individual score
                score_dir = SCORES_DIR / model_name / condition
                score_dir.mkdir(parents=True, exist_ok=True)
                with open(score_dir / f"{lang_code}.json", "w") as f:
                    json.dump(scores, f, indent=2)

                # Aggregate for summary
                cond_key = f"{model_name}/{condition}"
                if cond_key not in summary_by_condition:
                    summary_by_condition[cond_key] = {
                        "model": model_name,
                        "condition": condition,
                        "chrf_scores": [],
                        "ph_rates": [],
                        "untranslated_rates": [],
                        "leakage_rates": [],
                        "costs": [],
                        "languages": [],
                    }
                s = summary_by_condition[cond_key]
                if chrf != "N/A" and chrf is not None:
                    s["chrf_scores"].append(chrf)
                s["ph_rates"].append(ph_rate)
                s["untranslated_rates"].append(scores["metrics"]["untranslated_rate"])
                s["leakage_rates"].append(scores["metrics"]["instruction_leakage_rate"])
                s["costs"].append(scores["cost"])
                s["languages"].append(lang_code)

    # Build summary
    summary_rows = []
    for cond_key, s in sorted(summary_by_condition.items()):
        row = {
            "model": s["model"],
            "condition": s["condition"],
            "languages": len(s["languages"]),
            "mean_chrf": round(sum(s["chrf_scores"]) / max(len(s["chrf_scores"]), 1), 2),
            "mean_placeholder_preservation": round(sum(s["ph_rates"]) / max(len(s["ph_rates"]), 1), 2),
            "mean_untranslated_rate": round(sum(s["untranslated_rates"]) / max(len(s["untranslated_rates"]), 1), 2),
            "mean_leakage_rate": round(sum(s["leakage_rates"]) / max(len(s["leakage_rates"]), 1), 2),
            "total_cost": round(sum(s["costs"]), 4),
        }
        summary_rows.append(row)

    # Print summary table
    print("\n═══════════════════════════════════════════════════════")
    print("  champollion-bench: UI String Scoring Summary")
    print("═══════════════════════════════════════════════════════")
    print(f"  {'Model':<20} {'Condition':<10} {'chrF++':<8} {'PH%':<7} {'Untrans%':<10} {'Leak%':<7} {'Cost':<8}")
    print("  " + "─" * 70)
    for row in summary_rows:
        print(
            f"  {row['model']:<20} {row['condition']:<10} "
            f"{row['mean_chrf']:<8.2f} {row['mean_placeholder_preservation']:<7.1f} "
            f"{row['mean_untranslated_rate']:<10.1f} {row['mean_leakage_rate']:<7.1f} "
            f"${row['total_cost']:<7.4f}"
        )
    print("═══════════════════════════════════════════════════════\n")

    # Save summary
    SCORES_DIR.mkdir(parents=True, exist_ok=True)
    summary_doc = {
        "timestamp": max(s.get("timestamp", "") for s in all_scores) if all_scores else "",
        "dataset": "ui-bench",
        "total_scored": len(all_scores),
        "results": summary_rows,
        "per_language": all_scores,
    }
    with open(SCORES_DIR / "summary.json", "w") as f:
        json.dump(summary_doc, f, indent=2)

    print(f"  Scores saved: {SCORES_DIR}/")


if __name__ == "__main__":
    main()
