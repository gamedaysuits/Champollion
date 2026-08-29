"""
Tests for the three metric detector plugins:
    - CodeSwitchingPlugin (code_switching.py)
    - HallucinationPlugin (hallucination.py)
    - TerminologyPlugin (terminology.py)

Validates that each plugin:
    - Follows the MetricPlugin protocol (name, compute, aggregate)
    - Returns correct metric keys matching scoring.py weight tables
    - Handles edge cases (empty strings, identical source/target)
    - Produces values on 0.0–1.0 scale

Test class structure mirrors test_scoring_ssot.py conventions.
"""

from mt_eval_harness.plugins.code_switching import CodeSwitchingPlugin
from mt_eval_harness.plugins.hallucination import HallucinationPlugin
from mt_eval_harness.plugins.terminology import TerminologyPlugin


# ---------------------------------------------------------------------------
# CodeSwitchingPlugin
# ---------------------------------------------------------------------------

class TestCodeSwitchingPlugin:
    """Validate code-switching rate detection."""

    def test_protocol_compliance(self):
        """Plugin must have name, compute(), and aggregate()."""
        plugin = CodeSwitchingPlugin(target_scripts=["Cyrillic"])
        assert hasattr(plugin, "name")
        assert plugin.name == "code_switching"
        assert callable(plugin.compute)
        assert callable(plugin.aggregate)

    def test_metric_key_matches_scoring(self):
        """Output key must be 'code_switching_rate' to match scoring.py."""
        plugin = CodeSwitchingPlugin(target_scripts=["Cyrillic"])
        result = plugin.compute({
            "source": "Hello",
            "predicted": "Привет",
            "expected": "Привет",
        })
        assert "code_switching_rate" in result

    def test_no_code_switching(self):
        """Pure target-script output → rate = 0.0."""
        plugin = CodeSwitchingPlugin(
            target_scripts=["Cyrillic"],
            source_script="Latin",
        )
        result = plugin.compute({
            "source": "Hello world",
            "predicted": "Привет мир",
            "expected": "Привет мир",
        })
        assert result["code_switching_rate"] == 0.0

    def test_full_code_switching(self):
        """All Latin tokens in Cyrillic target → rate > 0."""
        plugin = CodeSwitchingPlugin(
            target_scripts=["Cyrillic"],
            source_script="Latin",
        )
        result = plugin.compute({
            "source": "Hello world",
            "predicted": "Hello world",  # Source echoed — all wrong script
            "expected": "Привет мир",
        })
        assert result["code_switching_rate"] > 0.0

    def test_partial_code_switching(self):
        """Mixed scripts → intermediate rate."""
        plugin = CodeSwitchingPlugin(
            target_scripts=["Cyrillic"],
            source_script="Latin",
        )
        result = plugin.compute({
            "source": "Hello world and goodbye",
            "predicted": "Привет world и goodbye",  # 2 Latin, 2 Cyrillic
            "expected": "Привет мир и до свидания",
        })
        rate = result["code_switching_rate"]
        assert 0.0 < rate < 1.0

    def test_empty_prediction(self):
        """Empty prediction → rate = 0.0 (not a code-switching issue)."""
        plugin = CodeSwitchingPlugin(target_scripts=["Cyrillic"])
        result = plugin.compute({
            "source": "Hello",
            "predicted": "",
            "expected": "Привет",
        })
        assert result["code_switching_rate"] == 0.0

    def test_same_script_source_and_target(self):
        """Latin→Latin (e.g., en→fr) — no code-switching detectable by script."""
        plugin = CodeSwitchingPlugin(
            target_scripts=["Latin"],
            source_script="Latin",
        )
        result = plugin.compute({
            "source": "Hello world",
            "predicted": "Bonjour le monde",
            "expected": "Bonjour le monde",
        })
        assert result["code_switching_rate"] == 0.0

    def test_untranslated_run_detection(self):
        """Three or more consecutive source tokens in output → flagged."""
        plugin = CodeSwitchingPlugin(
            target_scripts=["Cyrillic"],
            source_script="Latin",
        )
        result = plugin.compute({
            "source": "The quick brown fox jumps over the lazy dog",
            "predicted": "Быстрая the quick brown fox прыгает",
            "expected": "Быстрая коричневая лиса прыгает через ленивую собаку",
        })
        assert result["cs_untranslated_run_tokens"] >= 4

    def test_auto_detect_target_script(self):
        """Auto-detect target script from expected translation."""
        plugin = CodeSwitchingPlugin()  # No target_scripts provided
        result = plugin.compute({
            "source": "Hello",
            "predicted": "Hello",  # Wrong — should be Cyrillic
            "expected": "Привет",
        })
        # After auto-detection, should detect Latin as wrong
        assert result["code_switching_rate"] > 0.0

    def test_aggregate(self):
        """Aggregate computes mean rate and counts."""
        plugin = CodeSwitchingPlugin(target_scripts=["Cyrillic"])
        results = [
            {"code_switching_rate": 0.0, "cs_wrong_script_tokens": 0,
             "cs_total_tokens": 5, "cs_untranslated_run_tokens": 0},
            {"code_switching_rate": 0.5, "cs_wrong_script_tokens": 3,
             "cs_total_tokens": 6, "cs_untranslated_run_tokens": 0},
        ]
        agg = plugin.aggregate(results)
        assert agg["avg_code_switching_rate"] == 0.25
        assert agg["entries_with_code_switching"] == 1
        assert agg["total_wrong_script_tokens"] == 3

    def test_rate_bounded_0_1(self):
        """Rate must always be in [0.0, 1.0]."""
        plugin = CodeSwitchingPlugin(
            target_scripts=["Canadian_Aboriginal"],
            source_script="Latin",
        )
        # All tokens are Latin (wrong script for Cree)
        result = plugin.compute({
            "source": "a b c d e f g h i j k l m n o p",
            "predicted": "a b c d e f g h i j k l m n o p",
            "expected": "ᐊ ᐱ ᑭ",
        })
        assert 0.0 <= result["code_switching_rate"] <= 1.0


# ---------------------------------------------------------------------------
# HallucinationPlugin
# ---------------------------------------------------------------------------

class TestHallucinationPlugin:
    """Validate hallucination rate detection."""

    def test_protocol_compliance(self):
        """Plugin must have name, compute(), and aggregate()."""
        plugin = HallucinationPlugin()
        assert hasattr(plugin, "name")
        assert plugin.name == "hallucination"
        assert callable(plugin.compute)
        assert callable(plugin.aggregate)

    def test_metric_key_matches_scoring(self):
        """Output key must be 'hallucination_rate' to match scoring.py."""
        plugin = HallucinationPlugin()
        result = plugin.compute({
            "source": "Hello",
            "predicted": "Bonjour",
        })
        assert "hallucination_rate" in result

    def test_clean_translation(self):
        """Normal translation → low/zero hallucination rate."""
        plugin = HallucinationPlugin()
        result = plugin.compute({
            "source": "The cat sat on the mat.",
            "predicted": "Le chat était assis sur le tapis.",
        })
        assert result["hallucination_rate"] < 0.2

    def test_length_inflation(self):
        """Output 5x longer than source → flagged."""
        plugin = HallucinationPlugin()
        result = plugin.compute({
            "source": "Hello",
            "predicted": "Hello " * 50,  # Massive inflation
        })
        assert result["hallucination_rate"] > 0.0
        assert result["hall_length_score"] > 0.0

    def test_repetition_detection(self):
        """Repeated phrases → flagged as degenerate output."""
        plugin = HallucinationPlugin()
        result = plugin.compute({
            "source": "What is the weather like?",
            "predicted": "the weather is good " * 20,
        })
        assert result["hall_repetition_score"] > 0.0

    def test_source_echo(self):
        """Output identical to source → echo flagged."""
        plugin = HallucinationPlugin()
        result = plugin.compute({
            "source": "Hello world, how are you?",
            "predicted": "Hello world, how are you?",
        })
        assert result["hall_echo_score"] == 1.0

    def test_empty_prediction(self):
        """Empty prediction → rate = 0.0 (different error, not hallucination)."""
        plugin = HallucinationPlugin()
        result = plugin.compute({
            "source": "Hello",
            "predicted": "",
        })
        assert result["hallucination_rate"] == 0.0

    def test_normal_length_ratio(self):
        """Output within 0.5x–3.0x of source → no length penalty."""
        plugin = HallucinationPlugin()
        result = plugin.compute({
            "source": "Hello world",
            "predicted": "Bonjour le monde entier",
        })
        assert result["hall_length_score"] == 0.0

    def test_entity_mismatch(self):
        """Fabricated entities not in source → flagged."""
        plugin = HallucinationPlugin()
        result = plugin.compute({
            "source": "The cat sat on the mat.",
            "predicted": "Le chat de Monsieur Bonaparte était sur le tapis de Paris.",
        })
        assert result["hall_entity_score"] > 0.0

    def test_non_latin_source_zeroes_entity_heuristic(self):
        """Regression: a non-Latin SOURCE must zero the entity heuristic. The
        Latin-capitalization entity proxy finds no source entities for scripts
        without ASCII uppercase, so capitalized words in a faithful Latin-script
        translation previously scored entity_score 1.0 — a pure false positive
        for the majority of the low-resource catalogue (Amharic, Arabic, Hindi,
        Chinese, Thai, …). This check is length-independent (the length signal
        is a separate, legitimate heuristic)."""
        plugin = HallucinationPlugin()
        non_latin_sources = {
            "amharic": "ይህ ለሙከራ ዓረፍተ ነገር ነው።",       # Ge'ez
            "arabic": "هذه جملة اختبار بسيطة.",          # Arabic
            "hindi": "यह एक परीक्षण वाक्य है।",          # Devanagari
            "chinese": "这是一个测试句子。",               # Han
            "thai": "นี่คือประโยคทดสอบ",                  # Thai
        }
        # A faithful translation into a Latin-script language: legitimately
        # capitalized words (sentence-initial + proper nouns).
        predicted = "This is a simple test sentence about Ethiopia and Cairo."
        for label, source in non_latin_sources.items():
            result = plugin.compute({"source": source, "predicted": predicted})
            assert result["hall_entity_score"] == 0.0, (
                f"{label}: non-Latin source must zero the entity heuristic"
            )

    def test_non_latin_source_not_flagged_when_length_balanced(self):
        """End-to-end: a faithful non-Latin→Latin translation with a normal
        length ratio is NOT flagged as hallucinating. Before the fix the entity
        heuristic alone scored 1.0 → hallucination_rate 0.2 (entity_weight 0.2),
        over the 0.1 flag threshold; now it stays at 0.0."""
        plugin = HallucinationPlugin()
        # Length-balanced so the (independent) length/echo/repetition signals
        # stay at 0 — isolating the entity false-fire end-to-end.
        source = "ይህ ዓረፍተ ነገር ስለ ኢትዮጵያ እና ካይሮ ነው።"  # ~ About Ethiopia and Cairo
        predicted = "This sentence is about Ethiopia and Cairo."
        result = plugin.compute({"source": source, "predicted": predicted})
        assert result["hall_entity_score"] == 0.0
        assert result["hall_length_score"] == 0.0  # ratio within normal bounds
        assert result["hallucination_rate"] <= 0.1  # not flagged (was ≥ 0.2)

    def test_latin_source_still_detects_fabricated_entities(self):
        """The guard must not disable the heuristic for legitimate Latin
        sources — fabricated entities are still caught."""
        plugin = HallucinationPlugin()
        result = plugin.compute({
            "source": "The cat sat on the mat.",
            "predicted": "The cat sat near Napoleon in Paris.",
        })
        assert result["hall_entity_score"] > 0.0

    def test_rate_bounded_0_1(self):
        """Rate must always be in [0.0, 1.0]."""
        plugin = HallucinationPlugin()
        result = plugin.compute({
            "source": "x",
            "predicted": "word " * 1000,  # Extreme case
        })
        assert 0.0 <= result["hallucination_rate"] <= 1.0

    def test_aggregate(self):
        """Aggregate computes mean rates and flag counts."""
        plugin = HallucinationPlugin()
        results = [
            {"hallucination_rate": 0.0, "hall_length_score": 0.0,
             "hall_repetition_score": 0.0, "hall_entity_score": 0.0,
             "hall_echo_score": 0.0},
            {"hallucination_rate": 0.5, "hall_length_score": 0.3,
             "hall_repetition_score": 0.2, "hall_entity_score": 0.1,
             "hall_echo_score": 0.0},
        ]
        agg = plugin.aggregate(results)
        assert agg["avg_hallucination_rate"] == 0.25
        assert agg["entries_flagged_hallucination"] == 1
        assert agg["max_hallucination_rate"] == 0.5


# ---------------------------------------------------------------------------
# TerminologyPlugin
# ---------------------------------------------------------------------------

class TestTerminologyPlugin:
    """Validate terminology adherence checking."""

    def test_protocol_compliance(self):
        """Plugin must have name, compute(), and aggregate()."""
        plugin = TerminologyPlugin(glossary={"hello": ["bonjour"]})
        assert hasattr(plugin, "name")
        assert plugin.name == "terminology"
        assert callable(plugin.compute)
        assert callable(plugin.aggregate)

    def test_metric_key_matches_scoring(self):
        """Output key must be 'terminology_adherence' to match scoring.py."""
        plugin = TerminologyPlugin(glossary={"hello": ["bonjour"]})
        result = plugin.compute({
            "source": "hello world",
            "predicted": "bonjour le monde",
        })
        assert "terminology_adherence" in result

    def test_no_glossary_returns_none(self):
        """Without a glossary, metric is unavailable (None)."""
        plugin = TerminologyPlugin()
        result = plugin.compute({
            "source": "Hello",
            "predicted": "Bonjour",
        })
        assert result["terminology_adherence"] is None

    def test_all_terms_matched(self):
        """All glossary terms correctly translated → adherence = 1.0."""
        plugin = TerminologyPlugin(glossary={
            "user": ["utilisateur", "utilisatrice"],
            "settings": ["paramètres", "réglages"],
        })
        result = plugin.compute({
            "source": "Go to user settings to change your profile.",
            "predicted": "Allez dans les paramètres utilisateur pour modifier votre profil.",
        })
        assert result["terminology_adherence"] == 1.0
        assert result["term_matches"] == 2
        assert result["term_total"] == 2

    def test_no_terms_in_source(self):
        """Glossary terms not in source → adherence = 1.0 (nothing to violate)."""
        plugin = TerminologyPlugin(glossary={
            "database": ["base de données"],
        })
        result = plugin.compute({
            "source": "Hello world",
            "predicted": "Bonjour le monde",
        })
        assert result["terminology_adherence"] == 1.0
        assert result["term_total"] == 0

    def test_term_missed(self):
        """Glossary term in source but not translated → adherence < 1.0."""
        plugin = TerminologyPlugin(glossary={
            "user": ["utilisateur"],
            "settings": ["paramètres"],
        })
        result = plugin.compute({
            "source": "Go to user settings.",
            "predicted": "Allez dans les réglages utilisateur.",  # "settings" not matched
        })
        assert result["terminology_adherence"] == 0.5
        assert result["term_misses"] == ["settings"]

    def test_case_insensitive_default(self):
        """Default is case-insensitive matching."""
        plugin = TerminologyPlugin(glossary={
            "User": ["utilisateur"],
        })
        result = plugin.compute({
            "source": "The user can log in.",
            "predicted": "L'utilisateur peut se connecter.",
        })
        assert result["terminology_adherence"] == 1.0

    def test_case_sensitive_mode(self):
        """Case-sensitive mode respects exact case in source terms."""
        plugin = TerminologyPlugin(
            glossary={"User": ["Utilisateur"]},
            case_sensitive=True,
        )
        # "user" (lowercase) shouldn't match "User" (title case)
        result = plugin.compute({
            "source": "The user can log in.",
            "predicted": "L'utilisateur peut se connecter.",
        })
        # "User" not found in source (case mismatch) → no terms to check
        assert result["term_total"] == 0

    def test_empty_source(self):
        """Empty source → adherence = 1.0 (nothing to violate)."""
        plugin = TerminologyPlugin(glossary={"hello": ["bonjour"]})
        result = plugin.compute({
            "source": "",
            "predicted": "something",
        })
        assert result["terminology_adherence"] == 1.0

    def test_empty_prediction(self):
        """Empty prediction → adherence = 1.0 (graceful handling)."""
        plugin = TerminologyPlugin(glossary={"hello": ["bonjour"]})
        result = plugin.compute({
            "source": "",
            "predicted": "",
        })
        assert result["terminology_adherence"] == 1.0

    def test_aggregate_with_glossary(self):
        """Aggregate computes mean adherence and miss counts."""
        plugin = TerminologyPlugin(glossary={"hello": ["bonjour"]})
        results = [
            {"terminology_adherence": 1.0, "term_matches": 1,
             "term_total": 1, "term_misses": []},
            {"terminology_adherence": 0.0, "term_matches": 0,
             "term_total": 1, "term_misses": ["hello"]},
        ]
        agg = plugin.aggregate(results)
        assert agg["avg_terminology_adherence"] == 0.5
        assert agg["total_term_matches"] == 1
        assert agg["total_term_total"] == 2
        assert len(agg["most_missed_terms"]) == 1
        assert agg["most_missed_terms"][0]["term"] == "hello"

    def test_aggregate_no_glossary(self):
        """Aggregate with null adherence entries → None average."""
        plugin = TerminologyPlugin()
        results = [
            {"terminology_adherence": None, "term_matches": 0,
             "term_total": 0, "term_misses": []},
        ]
        agg = plugin.aggregate(results)
        assert agg["avg_terminology_adherence"] is None

    def test_adherence_bounded_0_1(self):
        """Adherence must always be in [0.0, 1.0] or None."""
        plugin = TerminologyPlugin(glossary={
            "a": ["x"], "b": ["y"], "c": ["z"],
        })
        result = plugin.compute({
            "source": "a b c d e f",
            "predicted": "nothing matches here",
        })
        adherence = result["terminology_adherence"]
        assert adherence is None or 0.0 <= adherence <= 1.0
