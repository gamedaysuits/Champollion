import re

class DoublePassCompliancePlugin:
    """MetricPlugin that evaluates compliance both before and after post-processing."""
    name = "double_pass_compliance"

    def __init__(self, card: dict):
        self.rules = card.get("rules", {})
        self.target_name = card.get("name", "Target")

    def compute(self, entry: dict) -> dict:
        """Compute compliance scores before and after applying pipeline changes."""
        source = entry.get("source", "")
        raw_predicted = entry.get("raw_predicted", "") or entry.get("predicted", "")
        final_predicted = entry.get("predicted", "")

        # Evaluate compliance on both passes
        raw_stats = self._evaluate_compliance(source, raw_predicted)
        final_stats = self._evaluate_compliance(source, final_predicted)

        # Delta calculation: positive means post-processing corrected the issue
        delta_vars = final_stats["var_integrity"] - raw_stats["var_integrity"]
        delta_quotes = final_stats["quote_compliance"] - raw_stats["quote_compliance"]
        delta_casing = final_stats["casing_compliance"] - raw_stats["casing_compliance"]

        # Composite compliance indexes (60% variables, 20% quotes, 20% casing)
        raw_compliance = (raw_stats["var_integrity"] * 0.6) + (raw_stats["quote_compliance"] * 0.2) + (raw_stats["casing_compliance"] * 0.2)
        final_compliance = (final_stats["var_integrity"] * 0.6) + (final_stats["quote_compliance"] * 0.2) + (final_stats["casing_compliance"] * 0.2)

        return {
            "raw_var_integrity": raw_stats["var_integrity"],
            "raw_quote_compliance": raw_stats["quote_compliance"],
            "raw_casing_compliance": raw_stats["casing_compliance"],
            "raw_compliance_index": round(raw_compliance, 4),

            "final_var_integrity": final_stats["var_integrity"],
            "final_quote_compliance": final_stats["quote_compliance"],
            "final_casing_compliance": final_stats["casing_compliance"],
            "final_compliance_index": round(final_compliance, 4),

            "repair_delta_vars": delta_vars,
            "repair_delta_quotes": delta_quotes,
            "repair_delta_casing": delta_casing,
            "repaired": (delta_vars > 0 or delta_quotes > 0 or delta_casing > 0)
        }

    def _evaluate_compliance(self, source: str, predicted: str) -> dict:
        """Evaluate deterministic rules on a single translated string."""
        if not predicted:
            return {"var_integrity": 0.0, "quote_compliance": 0.0, "casing_compliance": 0.0}

        # 1. Variable / Placeholder check
        expected_vars = set(re.findall(r"\{[a-zA-Z0-9_]+\}", source))
        predicted_vars = set(re.findall(r"\{[a-zA-Z0-9_]+\}", predicted))
        var_integrity = 1.0 if (expected_vars == predicted_vars) else 0.0

        # 2. Quotes check
        quote_score = 1.0
        typo = self.rules.get("typography", {})
        if typo and "quoteStart" in typo and "quoteEnd" in typo:
            # Check if source contains quotes (English quotes or standard single/double quotes)
            source_has_quotes = any(q in source for q in ['"', "'", "“", "”", "‘", "’"])
            if source_has_quotes:
                start_q = typo["quoteStart"]
                end_q = typo["quoteEnd"]
                # If neither the start nor end quote is present in the output, penalize
                if start_q not in predicted and end_q not in predicted:
                    quote_score = 0.0

        # 3. Capitalization / casing check
        casing_score = 1.0
        casing = self.rules.get("capitalization", {})
        if casing and casing.get("hasCase") is False:
            # For languages without letter casing (Japanese, Chinese, Arabic, Hindi, Hebrew)
            # check if Latin letters leaked into the prediction (often a sign of markdown or untranslated segments)
            if re.search(r"[a-zA-Z]", predicted):
                # Ignore if the source was entirely English keywords or placeholders
                source_letters = re.sub(r"\{[a-zA-Z0-9_]+\}", "", source) # remove variables
                source_letters = re.sub(r"\s+", "", source_letters)
                if not re.search(r"[a-zA-Z]", source_letters):
                    # Only penalize if we leaked English words not present or not solely as short abbreviations
                    casing_score = 0.5

        return {
            "var_integrity": var_integrity,
            "quote_compliance": quote_score,
            "casing_compliance": casing_score
        }

    def aggregate(self, entry_results: list[dict]) -> dict:
        """Compute corpus-level structural compliance aggregates."""
        # Filter out entries that errored during compute()
        valid_results = [r for r in entry_results if "error" not in r]
        total = len(valid_results)
        if not total:
            return {}

        avg_raw_var = sum(r["raw_var_integrity"] for r in valid_results) / total
        avg_raw_quote = sum(r["raw_quote_compliance"] for r in valid_results) / total
        avg_raw_casing = sum(r["raw_casing_compliance"] for r in valid_results) / total
        avg_raw_compliance = sum(r["raw_compliance_index"] for r in valid_results) / total

        avg_final_var = sum(r["final_var_integrity"] for r in valid_results) / total
        avg_final_quote = sum(r["final_quote_compliance"] for r in valid_results) / total
        avg_final_casing = sum(r["final_casing_compliance"] for r in valid_results) / total
        avg_final_compliance = sum(r["final_compliance_index"] for r in valid_results) / total

        repaired_vars = sum(1 for r in valid_results if r["repair_delta_vars"] > 0)
        repaired_quotes = sum(1 for r in valid_results if r["repair_delta_quotes"] > 0)
        repaired_casing = sum(1 for r in valid_results if r["repair_delta_casing"] > 0)
        total_repaired = sum(1 for r in valid_results if r["repaired"])

        return {
            "raw_avg_variable_integrity": round(avg_raw_var, 4),
            "raw_avg_quote_compliance": round(avg_raw_quote, 4),
            "raw_avg_casing_compliance": round(avg_raw_casing, 4),
            "raw_overall_compliance": round(avg_raw_compliance, 4),

            "final_avg_variable_integrity": round(avg_final_var, 4),
            "final_avg_quote_compliance": round(avg_final_quote, 4),
            "final_avg_casing_compliance": round(avg_final_casing, 4),
            "final_overall_compliance": round(avg_final_compliance, 4),

            "repaired_variables": repaired_vars,
            "repaired_quotes": repaired_quotes,
            "repaired_casing": repaired_casing,
            "total_repaired_segments": total_repaired,
            "repair_effectiveness_rate": round(total_repaired / total, 4)
        }
