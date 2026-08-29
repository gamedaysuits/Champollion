"""
Tests for mt_eval_harness.publish — run card assembly and Supabase upsert.

Covers:
    - Fingerprint hash stability (same inputs → same hash/UUID,
      changed corpus sha256 → different hash/UUID)
    - assemble_run_card() with a minimal valid TestReport + RunLog pair
    - validate_row() — required NOT NULL field checking before upsert
    - _upsert_with_retry() — exponential backoff on 5xx/network errors,
      immediate failure on 4xx
"""

import io
import json
import urllib.error
import urllib.request

import pytest

from mt_eval_harness import publish
from mt_eval_harness.publish import (
    assemble_run_card,
    validate_row,
    _entry_content_publishable,
    _extract_method_taxonomy,
    _license_is_redistributable,
    _lookup_corpus_license,
    _upsert_with_retry,
    OPTIONAL_NULLABLE_FIELDS,
    REQUIRED_ROW_FIELDS,
    UPSERT_MAX_ATTEMPTS,
)


# ---------------------------------------------------------------------------
# Fixtures: minimal RunLog + TestReport pair on disk
# ---------------------------------------------------------------------------

def _make_run_log(
    corpus_sha256: str = "a" * 64,
    dataset_id: str = "test_dataset",
) -> dict:
    """Create a minimal RunLog dict matching what assemble_run_card reads."""
    return {
        "run_id": "test_run_001",
        "harness_version": "9.0.0",
        "timestamp_start": "2026-01-01T00:00:00Z",
        "elapsed_s": 12.5,
        "total_cost_usd": 0.01,
        "cache_hits": 0,
        "config": {
            "model": "test-provider/test-model",
            "prompt_version": "v1",
            "temperature": 0.0,
            "max_tokens": 1024,
            "batch_size": 25,
            "dataset_id": dataset_id,
            "source_lang": "English",
            "target_lang": "French",
            "tools_enabled": False,
        },
        "provenance": {
            "corpus_sha256": corpus_sha256,
            "system_prompt_sha256": "b" * 64,
            "system_prompt_used": "Translate the following.",
            "dataset_meta": {"version": "1.0"},
        },
        "results": [
            {
                "id": 0,
                "source": "Hello.",
                "expected": "Bonjour.",
                "predicted": "Bonjour.",
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 100, "completion_tokens": 10},
                "error": None,
            },
            {
                "id": 1,
                "source": "Thank you.",
                "expected": "Merci.",
                "predicted": "Merci beaucoup.",
                "latency_s": 0.3,
                "usage": {"prompt_tokens": 80, "completion_tokens": 8},
                "error": None,
            },
        ],
    }


def _make_report(source_log_path: str) -> dict:
    """Create a minimal TestReport dict matching what assemble_run_card reads."""
    return {
        "source_log": source_log_path,
        "overall": {
            "total_entries": 2,
            "evaluated": 2,
            "exact_match_count": 1,
            "exact_match_rate": 0.5,
            "corpus_chrf": 55.0,
            "corpus_bleu": 30.0,
            "corpus_ter": 40.0,
            "corpus_spbleu": 28.0,
            "corpus_chrf_plain": 52.0,
            "sacrebleu_signatures": {
                "chrf": "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.6.0",
                "bleu": "nrefs:1|case:mixed|eff:no|tok:13a|smooth:exp|version:2.6.0",
            },
            "avg_length_ratio": 1.1,
            "error_count": 0,
            "plugin_metrics": {},
        },
        "by_difficulty": {},
        "by_domain": {},
        "by_segment": {},
        "entries": [],
    }


def _write_pair(
    tmp_path,
    name: str,
    corpus_sha256: str = "a" * 64,
    dataset_id: str = "test_dataset",
):
    """Write a RunLog + TestReport pair to disk; return the report path."""
    tmp_path.mkdir(parents=True, exist_ok=True)
    run_log_path = tmp_path / f"{name}.json"
    run_log_path.write_text(
        json.dumps(_make_run_log(corpus_sha256, dataset_id)), encoding="utf-8"
    )
    report_path = tmp_path / f"{name}_report.json"
    report_path.write_text(
        json.dumps(_make_report(str(run_log_path))), encoding="utf-8"
    )
    return report_path


@pytest.fixture(autouse=True)
def no_git_provenance(monkeypatch):
    """Make assembly deterministic and fast — skip git subprocess calls."""
    monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)


# ---------------------------------------------------------------------------
# assemble_run_card — minimal valid report
# ---------------------------------------------------------------------------

class TestAssembleRunCard:
    """Assembly from a minimal RunLog + TestReport pair."""

    def test_returns_card_uuid_and_fingerprint(self, tmp_path):
        report_path = _write_pair(tmp_path, "run1")
        run_card, card_id, fingerprint_hash = assemble_run_card(report_path)

        assert isinstance(run_card, dict)
        assert len(fingerprint_hash) == 64  # SHA-256 hex
        # card_id is a valid UUID string
        import uuid as uuid_mod
        assert str(uuid_mod.UUID(card_id)) == card_id

    def test_card_core_fields(self, tmp_path):
        report_path = _write_pair(tmp_path, "run1")
        run_card, _, _ = assemble_run_card(report_path)

        assert run_card["run_id"] == "test_run_001"
        assert run_card["harness_version"] == "9.0.0"
        assert run_card["model_slug"] == "test-provider/test-model"
        assert run_card["condition"] == "v1"
        assert run_card["dataset"]["id"] == "test_dataset"
        assert run_card["dataset"]["language_pair"] == "eng>fra"
        assert run_card["dataset"]["sha256"] == "a" * 64

    def test_token_aggregation(self, tmp_path):
        report_path = _write_pair(tmp_path, "run1")
        run_card, _, _ = assemble_run_card(report_path)

        assert run_card["totals"]["prompt_tokens"] == 180
        assert run_card["totals"]["completion_tokens"] == 18
        assert run_card["totals"]["total_cost_usd"] == 0.01

    def test_scores_block(self, tmp_path):
        report_path = _write_pair(tmp_path, "run1")
        run_card, _, _ = assemble_run_card(report_path)

        scores = run_card["scores"]
        assert scores["exact_match_rate"] == 0.5
        assert scores["chrf_plus_plus"] == 55.0
        assert scores["composite"] is not None
        assert scores["avg_latency_seconds"] == 0.4

    def test_scores_carry_comparability_and_signatures(self, tmp_path):
        """spBLEU / plain chrF and the sacreBLEU signatures travel onto the card.

        These are what make a published surface score reproducible — the board
        reads the signatures from the run_card JSONB on row expand. Neural COMET
        stays separate (deterministic composite); see test_comparability_metrics.
        """
        report_path = _write_pair(tmp_path, "run1")
        run_card, _, _ = assemble_run_card(report_path)
        scores = run_card["scores"]
        assert scores["spbleu"] == 28.0
        assert scores["chrf_plain"] == 52.0
        sigs = scores["sacrebleu_signatures"]
        assert sigs["chrf"].endswith("version:2.6.0")
        assert "bleu" in sigs
        # Reproducibility payload must never leak into the deterministic composite.
        assert "sacrebleu_signatures" not in (run_card.get("fingerprint", {}).get("components", {}))

    def test_run_card_hash_is_set(self, tmp_path):
        report_path = _write_pair(tmp_path, "run1")
        run_card, _, _ = assemble_run_card(report_path)
        assert len(run_card["run_card_hash"]) == 64

    def test_missing_run_log_raises(self, tmp_path):
        report_path = tmp_path / "orphan_report.json"
        report_path.write_text(
            json.dumps(_make_report(str(tmp_path / "nonexistent.json"))),
            encoding="utf-8",
        )
        with pytest.raises(FileNotFoundError):
            assemble_run_card(report_path)


# ---------------------------------------------------------------------------
# Method taxonomy columns — method_class + orthogonal paradigm (migration 030)
# ---------------------------------------------------------------------------

class TestMethodTaxonomy:
    """_extract_method_taxonomy() maps the method card onto top-level columns."""

    def test_card_with_class_and_paradigm(self):
        run_card = {"method_card": {"class": "pipeline", "paradigm": "hybrid"}}
        assert _extract_method_taxonomy(run_card) == {
            "method_class": "pipeline",
            "paradigm": "hybrid",
        }

    def test_card_with_class_only_yields_null_paradigm(self):
        # A pre-paradigm card: method_class populates, paradigm stays NULL
        # (reads as "unknown" downstream).
        run_card = {"method_card": {"class": "raw-llm"}}
        assert _extract_method_taxonomy(run_card) == {
            "method_class": "raw-llm",
            "paradigm": None,
        }

    def test_harness_native_run_yields_both_null(self):
        # No method card (harness-native) → both columns NULL, never raises.
        assert _extract_method_taxonomy({}) == {
            "method_class": None,
            "paradigm": None,
        }
        assert _extract_method_taxonomy({"method_card": None}) == {
            "method_class": None,
            "paradigm": None,
        }

    def test_assemble_run_card_carries_paradigm(self, tmp_path):
        # End-to-end: a method card file with a paradigm flows into the run
        # card, where the publish row builder reads it.
        report_path = _write_pair(tmp_path, "run1")
        mc_path = tmp_path / "method_card.json"
        mc_path.write_text(
            json.dumps({
                "method_id": "apertium-crk",
                "name": "Apertium crk",
                "class": "pipeline",
                "paradigm": "rule-based",
            }),
            encoding="utf-8",
        )
        run_card, _, _ = assemble_run_card(report_path, method_card_path=mc_path)
        assert run_card["method_card"]["paradigm"] == "rule-based"
        # ...and the derived columns match what lands in the Supabase row.
        assert _extract_method_taxonomy(run_card) == {
            "method_class": "pipeline",
            "paradigm": "rule-based",
        }


# ---------------------------------------------------------------------------
# Dress-rehearsal regressions (verified against prod 2026-06-20):
#   1. An MT-engine run published the default LLM slug as model_slug, so a
#      `--method google-translate` run showed on the leaderboard as a Gemini
#      LLM run.
#   2. method_class + paradigm persisted NULL for ALL run cards, so the
#      leaderboard's method-axis filter couldn't classify any run.
# ---------------------------------------------------------------------------

def _write_custom_pair(tmp_path, name, config, provenance):
    """Write a RunLog + report pair with caller-supplied config + provenance."""
    tmp_path.mkdir(parents=True, exist_ok=True)
    log = _make_run_log()
    log["run_id"] = name
    log["config"] = config
    log["provenance"] = provenance
    log_path = tmp_path / f"{name}.json"
    log_path.write_text(json.dumps(log), encoding="utf-8")
    report = _make_report(str(log_path))
    report_path = tmp_path / f"{name}_report.json"
    report_path.write_text(json.dumps(report), encoding="utf-8")
    return report_path


_GOOGLE_METHOD_CARD = {
    "name": "google-translate",
    "method_id": "google-translate-v2",
    "class": "api",
    "paradigm": "neural-nmt",
    "author": "Google",
    "description": "Google Cloud Translation API v2.",
    "homepage": "https://cloud.google.com/translate",
    "tools_used": [],
    "supported_pairs": [],
    "license": "Proprietary (Google ToS)",
    "commercialReady": True,
    "cost_note": "~$20 / 1M characters",
}


class TestDressRehearsalRegressions:
    """model_slug + method taxonomy are honest for MT engines and LLMs."""

    def _mt_pair(self, tmp_path):
        # What the fixed runner writes for `--method google-translate`:
        # config.model relabeled to the engine id, the engine's method card
        # embedded in provenance.
        config = {
            "model": "google-translate",
            "_model_id": "google-translate",
            "mt_method": "google-translate",
            "provider": "openrouter",  # leftover default; irrelevant for MT
            "prompt_version": "naive",
            "temperature": 0.0,
            "source_lang": "English",
            "target_lang": "French",
        }
        provenance = {
            "corpus_sha256": "a" * 64,
            "system_prompt_sha256": "",
            "system_prompt_used": "",
            "dataset_meta": {"version": "1.0"},
            "method_card": dict(_GOOGLE_METHOD_CARD),
        }
        return _write_custom_pair(tmp_path, "gt_run", config, provenance)

    def test_mt_run_model_slug_is_engine_not_llm(self, tmp_path):
        run_card, _, _ = assemble_run_card(self._mt_pair(tmp_path))
        # Bug 1: must be the engine id, NOT the default LLM slug.
        assert run_card["model_slug"] == "google-translate"
        assert run_card["model_id"] == "google-translate"
        assert "gemini" not in run_card["model_slug"].lower()

    def test_mt_run_taxonomy_from_embedded_card(self, tmp_path):
        run_card, _, _ = assemble_run_card(self._mt_pair(tmp_path))
        # Bug 2: provenance method card flows through even with no --method-card.
        assert run_card["method_card"]["class"] == "api"
        assert publish._resolve_method_taxonomy(run_card) == {
            "method_class": "api",
            "paradigm": "neural-nmt",
        }

    def test_llm_run_records_real_model_and_llm_taxonomy(self, tmp_path):
        config = {
            "model": "google/gemini-3.1-pro-preview",
            "_model_id": "google/gemini-3.1-pro-preview",
            "mt_method": "",
            "provider": "openrouter",
            "prompt_version": "naive",
            "temperature": 0.0,
            "source_lang": "English",
            "target_lang": "French",
        }
        provenance = {
            "corpus_sha256": "a" * 64,
            "system_prompt_sha256": "",
            "system_prompt_used": "",
            "dataset_meta": {},
        }
        report_path = _write_custom_pair(tmp_path, "llm_run", config, provenance)
        run_card, _, _ = assemble_run_card(report_path)
        # Real model preserved; no method card invented.
        assert run_card["model_slug"] == "google/gemini-3.1-pro-preview"
        assert run_card["method_card"] is None
        # Bug 2: a harness-native LLM run is still classified, never NULL.
        assert publish._resolve_method_taxonomy(run_card) == {
            "method_class": "raw-llm",
            "paradigm": "llm",
        }

    def test_coached_llm_run_is_coached_class(self, tmp_path):
        config = {
            "model": "google/gemini-3.1-pro-preview",
            "_model_id": "google/gemini-3.1-pro-preview",
            "mt_method": "",
            "provider": "openrouter",
            "prompt_version": "naive",
            "temperature": 0.0,
            "source_lang": "English",
            "target_lang": "French",
        }
        provenance = {
            "corpus_sha256": "a" * 64,
            "system_prompt_sha256": "",
            "system_prompt_used": "",
            "dataset_meta": {},
            "coaching_prompt": "Mind the morphology.",
            "coaching_prompt_sha256": "c" * 64,
        }
        report_path = _write_custom_pair(tmp_path, "coached_run", config, provenance)
        run_card, _, _ = assemble_run_card(report_path)
        # assemble relabels naive→coached when coaching is present.
        assert run_card["condition"] == "coached"
        assert publish._resolve_method_taxonomy(run_card) == {
            "method_class": "coached-llm",
            "paradigm": "llm",
        }


# ---------------------------------------------------------------------------
# Corpus license passthrough (migration 015)
# ---------------------------------------------------------------------------

class TestCorpusLicensePassthrough:
    """corpus_license/corpus_attribution from arena/datasets/registry.json."""

    def test_registered_dataset_embeds_license(self, tmp_path, capsys):
        # 'eval-eng-haw-tatoeba-dev-v1' is a registered dataset (CC-BY-2.0, Tatoeba)
        report_path = _write_pair(
            tmp_path, "run1", dataset_id="eval-eng-haw-tatoeba-dev-v1"
        )
        run_card, _, _ = assemble_run_card(report_path)

        assert run_card["corpus_license"] == "CC-BY-2.0"
        assert "Tatoeba" in run_card["corpus_attribution"]
        # No registry warning for registered datasets
        assert "not in the" not in capsys.readouterr().out

    def test_registered_alias_resolves(self, tmp_path):
        # 'edtekla-dev' is an alias of 'eval-eng-crk-edtekla-dev-v1' in the registry
        report_path = _write_pair(tmp_path, "run1", dataset_id="edtekla-dev")
        run_card, _, _ = assemble_run_card(report_path)

        # EdTeKLA is recorded as its MODIFIED sovereignty-scoped grant
        # (LicenseRef), never plain CC BY-NC-SA (2026-07-19).
        assert run_card["corpus_license"] == (
            "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0")
        assert "University of Alberta" in run_card["corpus_attribution"]

    def test_unregistered_dataset_nulls_and_warns(self, tmp_path, capsys):
        report_path = _write_pair(tmp_path, "run1", dataset_id="test_dataset")
        run_card, _, _ = assemble_run_card(report_path)

        assert run_card["corpus_license"] is None
        assert run_card["corpus_attribution"] is None
        out = capsys.readouterr().out
        assert "test_dataset" in out
        assert "registry" in out

    def test_lookup_unknown_id_returns_none(self):
        assert _lookup_corpus_license("definitely-not-a-dataset") is None

    def test_lookup_empty_id_returns_none(self):
        assert _lookup_corpus_license("") is None

    def test_lookup_registered_id(self):
        info = _lookup_corpus_license("eval-eng-haw-tatoeba-dev-v1")
        assert info == {
            "license": "CC-BY-2.0",
            "attribution": "Tatoeba community (https://tatoeba.org)",
        }


# ---------------------------------------------------------------------------
# Dataset id resolution (corpus_path → registry id fallback)
# ---------------------------------------------------------------------------

class TestResolveDatasetId:
    """_resolve_dataset_id(): explicit id > corpus_path match > legacy filter."""

    def test_explicit_dataset_id_wins(self):
        config = {
            "dataset_id": "my-explicit-id",
            "corpus_path": "/tmp/eng-ceb-dev-v1.json",
            "dataset": "all",
        }
        assert publish._resolve_dataset_id(config) == "my-explicit-id"

    def test_corpus_path_basename_resolves_registry_id(self):
        # curated/eng-ceb-dev-v1.json is the registered path of
        # 'eval-eng-ceb-tatoeba-dev-v1'; any absolute prefix should still match.
        config = {
            "dataset_id": "",
            "corpus_path": "/anywhere/datasets/curated/eng-ceb-dev-v1.json",
            "dataset": "all",
        }
        assert publish._resolve_dataset_id(config) == "eval-eng-ceb-tatoeba-dev-v1"

    def test_corpus_stem_matches_alias(self):
        # 'edtekla-dev' is an alias of 'eval-eng-crk-edtekla-dev-v1', so a
        # local-only corpus whose filename stem matches the alias still
        # resolves to the canonical registry id.
        config = {
            "dataset_id": "",
            "corpus_path": "/somewhere/edtekla-dev.json",
            "dataset": "all",
        }
        assert publish._resolve_dataset_id(config) == "eval-eng-crk-edtekla-dev-v1"

    def test_unknown_corpus_falls_back_to_file_stem(self):
        # Ad-hoc corpora with no registry match publish under their file
        # stem — never the segment filter ("all"), which is meaningless
        # as a dataset id and unmatchable by the contribution queue.
        config = {
            "dataset_id": "",
            "corpus_path": "/tmp/some-ad-hoc-corpus.json",
            "dataset": "all",
        }
        assert publish._resolve_dataset_id(config) == "some-ad-hoc-corpus"

    def test_corpus_self_meta_corpus_id_wins_over_stem(self):
        # Self-describing curated corpora carry their canonical id —
        # preferred over registry/stem resolution (works on pip installs
        # where the bundled registry does not exist).
        config = {
            "dataset_id": "",
            "corpus_path": "/tmp/eng-xyz-dev-v1.json",
            "dataset": "all",
        }
        corpus_meta = {"corpus_id": "tatoeba-eng-xyz-dev"}
        assert (
            publish._resolve_dataset_id(config, corpus_meta)
            == "tatoeba-eng-xyz-dev"
        )

    def test_no_corpus_path_falls_back_to_legacy_filter(self):
        config = {"dataset_id": "", "corpus_path": None, "dataset": "dev"}
        assert publish._resolve_dataset_id(config) == "dev"


class TestShouldUpsertDataset:
    """_should_upsert_dataset(): only attempt the datasets POST for an
    UNREGISTERED corpus. A registered dataset already exists server-side and
    anon RLS forbids writing it, so a POST would only ever 403 — skip it. This
    is what keeps the queue/MCP publish path 403-free in the happy path."""

    def test_registered_id_is_not_upserted(self):
        # A real registered id — its row exists server-side already.
        assert publish._should_upsert_dataset("eval-eng-ilo-tatoeba-dev-v1") is False

    def test_registered_alias_is_not_upserted(self):
        # Aliases resolve to a registered entry too.
        assert publish._should_upsert_dataset("edtekla-dev") is False

    def test_unregistered_id_is_upserted(self):
        assert publish._should_upsert_dataset("some-ad-hoc-corpus") is True

    def test_empty_id_is_not_upserted(self):
        assert publish._should_upsert_dataset("") is False


# ---------------------------------------------------------------------------
# Fingerprint stability
# ---------------------------------------------------------------------------

class TestFingerprintStability:
    """Same inputs → same fingerprint/UUID; changed inputs → different."""

    def test_same_inputs_same_fingerprint(self, tmp_path):
        report_a = _write_pair(tmp_path / "a", "run1")
        report_b = _write_pair(tmp_path / "b", "run1")

        _, id_a, fp_a = assemble_run_card(report_a)
        _, id_b, fp_b = assemble_run_card(report_b)

        assert fp_a == fp_b
        assert id_a == id_b

    def test_repeated_assembly_is_deterministic(self, tmp_path):
        report_path = _write_pair(tmp_path, "run1")
        _, id_1, fp_1 = assemble_run_card(report_path)
        _, id_2, fp_2 = assemble_run_card(report_path)
        assert fp_1 == fp_2
        assert id_1 == id_2

    def test_changed_corpus_sha_changes_fingerprint(self, tmp_path):
        report_a = _write_pair(tmp_path / "a", "run1", corpus_sha256="a" * 64)
        report_b = _write_pair(tmp_path / "b", "run1", corpus_sha256="c" * 64)

        _, id_a, fp_a = assemble_run_card(report_a)
        _, id_b, fp_b = assemble_run_card(report_b)

        assert fp_a != fp_b
        assert id_a != id_b

    def test_fingerprint_components_recorded(self, tmp_path):
        report_path = _write_pair(tmp_path, "run1")
        run_card, _, fp = assemble_run_card(report_path)

        components = run_card["fingerprint"]["components"]
        assert components["dataset_sha256"] == "a" * 64
        assert components["model_slug"] == "test-provider/test-model"
        assert run_card["fingerprint"]["hash"] == fp


# ---------------------------------------------------------------------------
# Coached-condition derivation + coaching_data_sha256
# ---------------------------------------------------------------------------

def _write_coached_pair(
    tmp_path,
    name: str,
    prompt_version: str = "naive",
    coaching_prompt: str | None = "Translate formally. Glossary: dog -> atim.",
    coaching_sha: str | None = "c" * 64,
):
    """Write a RunLog + TestReport pair with coaching provenance."""
    tmp_path.mkdir(parents=True, exist_ok=True)
    run_log = _make_run_log()
    run_log["config"]["prompt_version"] = prompt_version
    if coaching_prompt is not None:
        run_log["provenance"]["coaching_prompt"] = coaching_prompt
        run_log["provenance"]["coaching_prompt_sha256"] = coaching_sha
    run_log_path = tmp_path / f"{name}.json"
    run_log_path.write_text(json.dumps(run_log), encoding="utf-8")
    report_path = tmp_path / f"{name}_report.json"
    report_path.write_text(
        json.dumps(_make_report(str(run_log_path))), encoding="utf-8"
    )
    return report_path


class TestCoachedCondition:
    """Coached runs publish as condition 'coached', not 'naive'."""

    def test_naive_with_coaching_relabelled_coached(self, tmp_path):
        # Legacy run log: coaching recorded in provenance but config still
        # says prompt_version="naive".
        report_path = _write_coached_pair(tmp_path, "run1")
        run_card, _, _ = assemble_run_card(report_path)
        assert run_card["condition"] == "coached"

    def test_coached_prompt_version_passes_through(self, tmp_path):
        # Run logs from the fixed CLI already carry prompt_version="coached".
        report_path = _write_coached_pair(
            tmp_path, "run1", prompt_version="coached"
        )
        run_card, _, _ = assemble_run_card(report_path)
        assert run_card["condition"] == "coached"

    def test_explicit_condition_not_relabelled(self, tmp_path):
        # A user-chosen prompt version is preserved even with coaching
        # in provenance (e.g. champollion-config runs).
        report_path = _write_coached_pair(
            tmp_path, "run1", prompt_version="champollion"
        )
        run_card, _, _ = assemble_run_card(report_path)
        assert run_card["condition"] == "champollion"

    def test_no_coaching_stays_naive(self, tmp_path):
        report_path = _write_coached_pair(
            tmp_path, "run1", coaching_prompt=None
        )
        run_card, _, _ = assemble_run_card(report_path)
        assert run_card["condition"] == "naive"
        assert run_card["coaching_data_sha256"] is None

    def test_coaching_data_sha256_populated(self, tmp_path):
        report_path = _write_coached_pair(tmp_path, "run1")
        run_card, _, _ = assemble_run_card(report_path)
        assert run_card["coaching_data_sha256"] == "c" * 64

    def test_empty_coaching_sha_normalized_to_none(self, tmp_path):
        # build_run_log writes "" when the sha is missing — the run card
        # field is nullable, so normalize to None.
        report_path = _write_coached_pair(tmp_path, "run1", coaching_sha="")
        run_card, _, _ = assemble_run_card(report_path)
        assert run_card["coaching_data_sha256"] is None

    def test_relabel_changes_fingerprint_vs_naive(self, tmp_path):
        # condition feeds the fingerprint (§3.8): a coached run must not
        # dedupe against a true naive baseline.
        report_naive = _write_coached_pair(
            tmp_path / "a", "run1", coaching_prompt=None
        )
        report_coached = _write_coached_pair(tmp_path / "b", "run1")

        _, id_naive, fp_naive = assemble_run_card(report_naive)
        _, id_coached, fp_coached = assemble_run_card(report_coached)

        assert fp_naive != fp_coached
        assert id_naive != id_coached
        # ...and the relabelled condition is what lands in the components.
        card, _, _ = assemble_run_card(report_coached)
        assert card["fingerprint"]["components"]["condition"] == "coached"


# ---------------------------------------------------------------------------
# Row validation
# ---------------------------------------------------------------------------

class TestVerifyCorpusIntegrity:
    """verify_corpus_integrity() — pre-publish anti-fraud gate (audit #3)."""

    def _card(self, **over) -> dict:
        card = {
            "dataset": {"id": "unregistered_x", "sha256": "abc123", "entry_count": 100},
            "scores": {"evaluated": 100, "total": 100},
        }
        card["dataset"].update(over.get("dataset", {}))
        card["scores"].update(over.get("scores", {}))
        return card

    def test_healthy_card_passes(self):
        # Unregistered dataset -> no registry sha to enforce; no raise.
        assert publish.verify_corpus_integrity(self._card()) == []

    def test_vacuous_run_blocked(self):
        with pytest.raises(publish.PublishIntegrityError):
            publish.verify_corpus_integrity(
                self._card(scores={"evaluated": 0, "total": 100})
            )

    def test_zero_entry_count_blocked(self):
        with pytest.raises(publish.PublishIntegrityError):
            publish.verify_corpus_integrity(
                self._card(dataset={"entry_count": 0}, scores={"evaluated": 0, "total": 0})
            )

    def test_sha_mismatch_blocked_when_registry_pins(self, monkeypatch):
        monkeypatch.setattr(
            publish, "_lookup_registry_entry",
            lambda _id: {"sha256": "DEADBEEF" + "0" * 56},
        )
        with pytest.raises(publish.PublishIntegrityError):
            publish.verify_corpus_integrity(
                self._card(dataset={"id": "pinned_ds", "sha256": "WRONGSHA"})
            )

    def test_sha_match_passes_when_registry_pins(self, monkeypatch):
        good = "f" * 64
        monkeypatch.setattr(
            publish, "_lookup_registry_entry", lambda _id: {"sha256": good},
        )
        assert publish.verify_corpus_integrity(
            self._card(dataset={"id": "pinned_ds", "sha256": good})
        ) == []

    def test_missing_run_sha_blocked_when_registry_pins(self, monkeypatch):
        monkeypatch.setattr(
            publish, "_lookup_registry_entry", lambda _id: {"sha256": "a" * 64},
        )
        with pytest.raises(publish.PublishIntegrityError):
            publish.verify_corpus_integrity(
                self._card(dataset={"id": "pinned_ds", "sha256": ""})
            )

    def test_unpinned_registered_dataset_warns_not_blocks(self, monkeypatch):
        # Registry entry exists but sha is null (today's schema-debt state):
        # warn, don't block.
        monkeypatch.setattr(
            publish, "_lookup_registry_entry", lambda _id: {"sha256": None},
        )
        warnings = publish.verify_corpus_integrity(
            self._card(dataset={"id": "unpinned_ds", "sha256": "whatever"})
        )
        assert any("no sha pinned" in w for w in warnings)


def _make_valid_row() -> dict:
    """A row carrying every required NOT NULL field."""
    return {
        "id": "8a32a432-1111-5222-8333-444455556666",
        "submitter": "tester@example.com",
        "affirmation": "Results generated by mt-eval harness v9.0.0.",
        "trust": "unverified",
        "model_slug": "test-provider/test-model",
        "condition": "v1",
        "dataset_id": "test_dataset",
        "language_pair": "eng>fra",
        "harness_version": "9.0.0",
        "run_card": {"run_id": "test_run_001"},
        "fingerprint_hash": "a" * 64,
    }


class TestValidateRow:
    """validate_row() flags missing/empty required NOT NULL fields."""

    def test_complete_row_passes(self):
        assert validate_row(_make_valid_row()) == []

    def test_missing_field_is_reported(self):
        row = _make_valid_row()
        del row["model_slug"]
        assert validate_row(row) == ["model_slug"]

    def test_none_field_is_reported(self):
        row = _make_valid_row()
        row["dataset_id"] = None
        assert validate_row(row) == ["dataset_id"]

    def test_empty_string_is_reported(self):
        row = _make_valid_row()
        row["harness_version"] = ""
        row["language_pair"] = "   "
        problems = validate_row(row)
        assert "harness_version" in problems
        assert "language_pair" in problems

    def test_empty_run_card_dict_is_reported(self):
        row = _make_valid_row()
        row["run_card"] = {}
        assert validate_row(row) == ["run_card"]

    def test_multiple_missing_fields_all_listed(self):
        row = _make_valid_row()
        del row["id"]
        del row["submitter"]
        row["trust"] = ""
        problems = validate_row(row)
        assert set(problems) >= {"id", "submitter", "trust"}

    def test_empty_condition_allowed_but_none_rejected(self):
        # condition is NOT NULL in the schema, but an empty string is a
        # legitimate value for runs without a prompt_version.
        row = _make_valid_row()
        row["condition"] = ""
        assert validate_row(row) == []
        row["condition"] = None
        assert validate_row(row) == ["condition"]

    def test_all_required_fields_checked(self):
        # Every field in REQUIRED_ROW_FIELDS is enforced when absent.
        empty_problems = validate_row({})
        for field in REQUIRED_ROW_FIELDS:
            assert field in empty_problems

    def test_null_corpus_license_is_optional(self):
        # corpus_license/corpus_attribution are nullable (migration 015):
        # None values must never block a publish (unregistered datasets).
        row = _make_valid_row()
        row["corpus_license"] = None
        row["corpus_attribution"] = None
        assert validate_row(row) == []

    def test_missing_corpus_license_is_optional(self):
        # Entirely absent is also fine — older rows predate migration 015.
        row = _make_valid_row()
        assert "corpus_license" not in row
        assert validate_row(row) == []

    def test_optional_fields_never_required(self):
        # Guard against someone adding these to the required tuples later.
        for field in OPTIONAL_NULLABLE_FIELDS:
            assert field not in REQUIRED_ROW_FIELDS
            assert field not in publish.REQUIRED_NOT_NULL_FIELDS
        assert "corpus_license" not in validate_row({})


# ---------------------------------------------------------------------------
# Retry logic — _upsert_with_retry with urllib mocked
# ---------------------------------------------------------------------------

class _FakeResponse:
    """Minimal context-manager response standing in for urlopen's return."""

    def __init__(self, body: bytes = b'[{"id": "row-1"}]'):
        self._body = body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self._body


def _http_error(code: int, body: bytes = b'{"message": "boom"}'):
    return urllib.error.HTTPError(
        url="https://example.supabase.co/rest/v1/run_cards",
        code=code,
        msg="error",
        hdrs=None,
        fp=io.BytesIO(body),
    )


def _make_request() -> urllib.request.Request:
    return urllib.request.Request(
        "https://example.supabase.co/rest/v1/run_cards",
        data=b"{}",
        method="POST",
    )


@pytest.fixture
def no_sleep(monkeypatch):
    """Record backoff delays instead of actually sleeping."""
    delays = []
    monkeypatch.setattr(publish.time, "sleep", delays.append)
    return delays


class TestUpsertRetry:
    """Retry on 5xx/network errors with backoff; fail fast on 4xx."""

    def test_success_first_try(self, monkeypatch, no_sleep, capsys):
        calls = []

        def fake_urlopen(req, timeout=None):
            calls.append(req)
            return _FakeResponse()

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        result = _upsert_with_retry(_make_request())

        assert result == [{"id": "row-1"}]
        assert len(calls) == 1
        assert no_sleep == []

    def test_5xx_then_success_succeeds(self, monkeypatch, no_sleep, capsys):
        attempts = []

        def fake_urlopen(req, timeout=None):
            attempts.append(1)
            if len(attempts) == 1:
                raise _http_error(500)
            return _FakeResponse()

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        result = _upsert_with_retry(_make_request())

        assert result == [{"id": "row-1"}]
        assert len(attempts) == 2
        assert no_sleep == [1]  # one backoff of 1s before the retry

    def test_two_5xx_then_success_backs_off_exponentially(
        self, monkeypatch, no_sleep, capsys
    ):
        attempts = []

        def fake_urlopen(req, timeout=None):
            attempts.append(1)
            if len(attempts) <= 2:
                raise _http_error(503)
            return _FakeResponse()

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        result = _upsert_with_retry(_make_request())

        assert result == [{"id": "row-1"}]
        assert len(attempts) == 3
        assert no_sleep == [1, 2]

    def test_4xx_fails_immediately_no_retry(self, monkeypatch, no_sleep, capsys):
        attempts = []

        def fake_urlopen(req, timeout=None):
            attempts.append(1)
            raise _http_error(403, body=b'{"message": "RLS violation"}')

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        with pytest.raises(SystemExit) as exc_info:
            _upsert_with_retry(_make_request())

        assert exc_info.value.code == 1
        assert len(attempts) == 1  # no retries on client errors
        assert no_sleep == []
        # Response body is shown to the user
        out = capsys.readouterr().out
        assert "403" in out
        assert "RLS violation" in out

    def test_network_error_then_success(self, monkeypatch, no_sleep, capsys):
        attempts = []

        def fake_urlopen(req, timeout=None):
            attempts.append(1)
            if len(attempts) == 1:
                raise urllib.error.URLError("connection refused")
            return _FakeResponse()

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        result = _upsert_with_retry(_make_request())

        assert result == [{"id": "row-1"}]
        assert len(attempts) == 2

    def test_timeout_is_retried(self, monkeypatch, no_sleep, capsys):
        attempts = []

        def fake_urlopen(req, timeout=None):
            attempts.append(1)
            if len(attempts) == 1:
                raise TimeoutError("timed out")
            return _FakeResponse()

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        result = _upsert_with_retry(_make_request())

        assert result == [{"id": "row-1"}]
        assert len(attempts) == 2

    def test_persistent_5xx_exhausts_attempts(self, monkeypatch, no_sleep, capsys):
        attempts = []

        def fake_urlopen(req, timeout=None):
            attempts.append(1)
            raise _http_error(500)

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        with pytest.raises(SystemExit) as exc_info:
            _upsert_with_retry(_make_request())

        assert exc_info.value.code == 1
        assert len(attempts) == UPSERT_MAX_ATTEMPTS
        assert no_sleep == [1, 2]  # no sleep after the final attempt

    def test_persistent_network_error_exhausts_attempts(
        self, monkeypatch, no_sleep, capsys
    ):
        attempts = []

        def fake_urlopen(req, timeout=None):
            attempts.append(1)
            raise urllib.error.URLError("no route to host")

        monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
        with pytest.raises(SystemExit):
            _upsert_with_retry(_make_request())

        assert len(attempts) == UPSERT_MAX_ATTEMPTS


# ---------------------------------------------------------------------------
# Entry-count parity enforcement (added 2026-06-13, audit companion)
# ---------------------------------------------------------------------------

class TestEntryCountEnforcement:
    """verify_corpus_integrity() blocks partial runs for sha-pinned datasets."""

    def _card(self, **over) -> dict:
        """Base run card with evaluable defaults."""
        card = {
            "dataset": {"id": "test_ds", "sha256": "abc123", "entry_count": 100},
            "scores": {"evaluated": 100, "total": 100},
        }
        card["dataset"].update(over.get("dataset", {}))
        card["scores"].update(over.get("scores", {}))
        return card

    def test_full_coverage_passes_with_pinned_sha(self, monkeypatch):
        """Running all entries of a sha-pinned dataset → no error."""
        sha = "f" * 64
        monkeypatch.setattr(
            publish, "_lookup_registry_entry",
            lambda _id: {"sha256": sha, "size": 100},
        )
        warnings = publish.verify_corpus_integrity(
            self._card(dataset={"id": "ds1", "sha256": sha},
                       scores={"evaluated": 100})
        )
        assert not any("Partial run" in w for w in warnings)

    def test_95_percent_coverage_passes(self, monkeypatch):
        """Evaluating 95% of entries passes (tolerance for filtered entries)."""
        sha = "f" * 64
        monkeypatch.setattr(
            publish, "_lookup_registry_entry",
            lambda _id: {"sha256": sha, "size": 100},
        )
        warnings = publish.verify_corpus_integrity(
            self._card(dataset={"id": "ds1", "sha256": sha},
                       scores={"evaluated": 95})
        )
        assert not any("Partial run" in w for w in warnings)

    def test_partial_run_blocked_for_pinned_sha(self, monkeypatch):
        """Running only 50/436 entries of a sha-pinned dataset → hard fail."""
        sha = "a" * 64
        monkeypatch.setattr(
            publish, "_lookup_registry_entry",
            lambda _id: {"sha256": sha, "size": 436},
        )
        with pytest.raises(publish.PublishIntegrityError, match="Partial run"):
            publish.verify_corpus_integrity(
                self._card(dataset={"id": "edtekla", "sha256": sha, "entry_count": 436},
                           scores={"evaluated": 50, "total": 436})
            )

    def test_partial_run_warns_for_unpinned_sha(self, monkeypatch):
        """Running 50/436 on an unpinned dataset → warning, not error."""
        monkeypatch.setattr(
            publish, "_lookup_registry_entry",
            lambda _id: {"sha256": None, "size": 436},
        )
        warnings = publish.verify_corpus_integrity(
            self._card(dataset={"id": "unpinned", "sha256": "xyz"},
                       scores={"evaluated": 50, "total": 436})
        )
        assert any("Partial run" in w for w in warnings)

    def test_no_registry_size_skips_check(self, monkeypatch):
        """Registry entry with no `size` field → check is a no-op."""
        sha = "f" * 64
        monkeypatch.setattr(
            publish, "_lookup_registry_entry",
            lambda _id: {"sha256": sha},  # no size field
        )
        warnings = publish.verify_corpus_integrity(
            self._card(dataset={"id": "ds_no_size", "sha256": sha},
                       scores={"evaluated": 10})
        )
        # Should pass — no size to check against
        assert not any("Partial run" in w for w in warnings)


# ---------------------------------------------------------------------------
# Generic plugin metric extraction (refactored 2026-06-13)
# ---------------------------------------------------------------------------

class TestGenericPluginExtraction:
    """_extract_lyss_verdicts() discovers plugins by field shape, not name."""

    def test_crk_named_plugins_still_discovered(self):
        """CRK plugins keyed as 'crk_linter' and 'crk_semantic' are found."""
        pm = {
            "crk_linter": {"equivalent_match": True, "lint_verdict": "EXACT"},
            "crk_semantic": {"semantic_verdict": "VALID"},
        }
        result = publish._extract_lyss_verdicts(pm)
        assert result["equivalent_match"] is True
        assert result["semantic_verdict"] == "VALID"

    def test_non_crk_named_plugins_discovered(self):
        """A hypothetical Navajo plugin keyed 'nv_linter' is also found."""
        pm = {
            "nv_linter": {"equivalent_match": False, "lint_verdict": "MISS"},
            "nv_semantic": {"semantic_verdict": "PARTIAL"},
        }
        result = publish._extract_lyss_verdicts(pm)
        assert result["equivalent_match"] is False
        assert result["semantic_verdict"] == "PARTIAL"

    def test_error_plugins_skipped(self):
        """Plugins that errored (non-dict or have 'error' key) are skipped."""
        pm = {
            "bad_linter": "ImportError: no module",
            "good_linter": {"equivalent_match": True},
        }
        result = publish._extract_lyss_verdicts(pm)
        assert result["equivalent_match"] is True

    def test_empty_plugin_metrics_returns_empty(self):
        """None or empty plugin_metrics → empty dict."""
        assert publish._extract_lyss_verdicts(None) == {}
        assert publish._extract_lyss_verdicts({}) == {}

    def test_fst_and_behavioral_still_work(self):
        """FST validity, code-switching, hallucination extraction unchanged."""
        pm = {
            "giellalt_fst_validity": {"fst_validity_rate": 1.0},
            "code_switching": {"code_switching_rate": 0.05},
            "hallucination": {"hallucination_rate": 0.0},
        }
        result = publish._extract_lyss_verdicts(pm)
        assert result["fst_valid"] is True
        assert result["code_switching_detected"] is True
        assert result["hallucination_detected"] is False


# ---------------------------------------------------------------------------
# Deterministic composite — neural metrics separated (by design)
# ---------------------------------------------------------------------------

class TestDeterministicCompositeSeparation:
    """End-to-end through assemble_run_card: the composite is DETERMINISTIC.
    Neural metrics (COMET/QE) are reported on their own keys and NEVER move the
    composite; the composite CI is recomputed at publish over the deterministic set.
    """

    def _assemble(self, tmp_path, name, *, comet_score):
        tmp_path.mkdir(parents=True, exist_ok=True)
        run_log_path = tmp_path / f"{name}.json"
        run_log_path.write_text(json.dumps(_make_run_log()), encoding="utf-8")

        report = _make_report(str(run_log_path))
        # A neural score is present on the run...
        report["overall"]["comet_score"] = comet_score
        report["overall"]["comet_model"] = "Unbabel/wmt22-comet-da"
        # ...with per-entry data so the publish-time composite CI bootstrap runs...
        report["entries"] = [
            {"id": 0, "source": "Hello.", "expected": "Bonjour.",
             "predicted": "Bonjour.", "error": False, "exact_match": True,
             "plugin_metrics": {}},
            {"id": 1, "source": "Thank you.", "expected": "Merci.",
             "predicted": "Merci beaucoup.", "error": False, "exact_match": False,
             "plugin_metrics": {}},
        ]
        # ...and a pre-existing composite CI so the recompute path is exercised.
        report["overall"]["confidence_intervals"] = {
            "composite_score": {"point_estimate": 0.0, "ci_lower": 0.0,
                                "ci_upper": 0.0, "metric_name": "composite_score"},
        }
        report_path = tmp_path / f"{name}_report.json"
        report_path.write_text(json.dumps(report), encoding="utf-8")
        run_card, _, _ = assemble_run_card(report_path)
        return run_card

    def test_neural_score_does_not_move_composite(self, tmp_path):
        # Identical deterministic inputs, wildly different COMET → SAME composite.
        lo = self._assemble(tmp_path / "lo", "run", comet_score=0.10)
        hi = self._assemble(tmp_path / "hi", "run", comet_score=0.95)
        assert lo["scores"]["composite"] == hi["scores"]["composite"]
        assert lo["scores"]["composite"] is not None

    def test_neural_reported_separately(self, tmp_path):
        card = self._assemble(tmp_path / "n", "run", comet_score=0.42)
        # COMET is present on its OWN key, distinct from the composite.
        assert card["scores"]["comet_score"] == 0.42
        assert card["scores"]["composite"] != 0.42

    def test_composite_ci_recomputed_and_wellformed(self, tmp_path):
        card = self._assemble(tmp_path / "c", "run", comet_score=0.42)
        ci = card["scores"]["confidence_intervals"]["composite_score"]
        # Recomputed at publish over the deterministic composite — a valid interval.
        assert ci["ci_lower"] is not None and ci["ci_upper"] is not None
        assert ci["ci_lower"] <= ci["ci_upper"]


class TestCorpusContentRedistributionGate:
    """The 'publish results without exposing the data' guardrail.

    Per-entry corpus CONTENT (source + human reference text) must only reach
    the public run_card_entries table for corpora that are genuinely cleared
    for redistribution. Restricted corpora and unregistered/own corpora must
    default to scores-only. These tests freeze that policy so a future edit to
    publish.py cannot silently re-open the EdTeKLA/Wolvengrey/held-out/private
    leak path.
    """

    # -- license classifier --
    def test_permissive_licenses_are_redistributable(self):
        for lic in ["CC-BY-4.0", "CC-BY-SA-4.0", "CC0-1.0", "cc0",
                    "Public Domain", "MIT", "Apache-2.0", "ODC-BY-1.0"]:
            assert _license_is_redistributable(lic) is True, lic

    def test_nc_and_nd_licenses_are_not_redistributable(self):
        for lic in ["CC-BY-NC-SA-4.0", "CC-BY-NC-4.0", "CC-BY-ND-4.0",
                    "CC BY NC", "proprietary", "Wolvengrey (permission pending)",
                    "All Rights Reserved"]:
            assert _license_is_redistributable(lic) is False, lic

    def test_unknown_license_fails_safe(self):
        assert _license_is_redistributable(None) is False
        assert _license_is_redistributable("") is False
        assert _license_is_redistributable("some-unrecognized-license") is False

    # -- the gate --
    def test_nc_corpus_content_never_published_even_without_flag(self):
        entry = {"license": "CC-BY-NC-SA-4.0", "segment": "development"}
        allowed, reason = _entry_content_publishable(
            entry, scores_only=False, override=False)
        assert allowed is False
        assert "non-commercial" in reason or "not redistribution-cleared" in reason

    def test_nc_corpus_content_not_overridable(self):
        # The --publish-entries override must NOT lift the NC block.
        entry = {"license": "CC-BY-NC-SA-4.0", "segment": "development"}
        allowed, _ = _entry_content_publishable(
            entry, scores_only=False, override=True)
        assert allowed is False

    def test_held_out_and_gold_standard_sealed(self):
        for seg in ("held_out", "gold_standard"):
            entry = {"license": "CC-BY-4.0", "segment": seg}
            allowed, reason = _entry_content_publishable(
                entry, scores_only=False, override=False)
            assert allowed is False
            assert "sealed" in reason

    def test_quarantined_corpus_content_withheld(self):
        entry = {"license": "CC-BY-4.0", "segment": "development",
                 "quarantine": True, "quarantine_reason": "improper subset"}
        allowed, reason = _entry_content_publishable(
            entry, scores_only=False, override=False)
        assert allowed is False
        assert "quarantined" in reason

    def test_permissive_registered_corpus_content_published(self):
        entry = {"license": "CC-BY-4.0", "segment": "development"}
        allowed, _ = _entry_content_publishable(
            entry, scores_only=False, override=False)
        assert allowed is True

    def test_unregistered_corpus_defaults_to_scores_only(self):
        allowed, reason = _entry_content_publishable(
            None, scores_only=False, override=False)
        assert allowed is False
        assert "unregistered" in reason

    def test_unregistered_corpus_with_explicit_override_publishes(self):
        allowed, _ = _entry_content_publishable(
            None, scores_only=False, override=True)
        assert allowed is True

    def test_scores_only_flag_forces_withhold_for_any_corpus(self):
        # Even a permissive, registered, development corpus is withheld when
        # the owner asks for scores-only (private/own data).
        entry = {"license": "CC-BY-4.0", "segment": "development"}
        allowed, reason = _entry_content_publishable(
            entry, scores_only=True, override=False)
        assert allowed is False
        assert "scores-only" in reason


# ---------------------------------------------------------------------------
# Concurrency idempotency — two simultaneous runs of one item never produce a
# duplicate run_card OR a spurious publish failure (requirement (b)).
# ---------------------------------------------------------------------------

class TestConcurrentPublishIdempotency:
    """Two contributors running the SAME queue item at once must converge to
    ONE row. This is guaranteed by (1) a deterministic fingerprint UUID — same
    corpus x model x condition x config → same id, so the upsert dedupes — and
    (2) _upsert_run_card recovering the loser of the race instead of failing.
    """

    def test_same_corpus_method_yields_same_card_id(self, tmp_path):
        # Identical experiment (same corpus sha, model, condition, defaults)
        # run twice → identical fingerprint UUID. The upsert merges on this id,
        # so the second publish updates the one row rather than minting a new
        # one. This is the "don't double-publish the same item" identity.
        report_a = _write_pair(tmp_path / "a", "run1",
                               corpus_sha256="d" * 64, dataset_id="ds_shared")
        report_b = _write_pair(tmp_path / "b", "run1",
                               corpus_sha256="d" * 64, dataset_id="ds_shared")
        _, id_a, fp_a = assemble_run_card(report_a)
        _, id_b, fp_b = assemble_run_card(report_b)
        assert fp_a == fp_b
        assert id_a == id_b

    def test_lost_race_upsert_recovers_existing_as_success(
        self, monkeypatch, capsys
    ):
        # The losing writer's upsert is RLS-rejected (403 → SystemExit) because
        # the row already exists (immutable). _upsert_run_card re-checks and
        # returns that existing row instead of failing — no duplicate, no error.
        def reject(req, timeout=15):
            raise SystemExit(1)

        monkeypatch.setattr(publish, "_upsert_with_retry", reject)
        monkeypatch.setattr(
            publish, "_fetch_existing_card",
            lambda cid: {"id": cid, "submitter": "other-contributor"},
        )
        row = publish._upsert_run_card(_make_request(), "card-xyz")
        assert row["submitter"] == "other-contributor"
        out = capsys.readouterr().out
        assert "another" in out.lower()

    def test_genuine_failure_with_no_row_still_raises(self, monkeypatch):
        # A real 4xx (bad payload / integrity rejection) leaves NO row behind,
        # so the error must propagate — recovery is only for the race case.
        def reject(req, timeout=15):
            raise SystemExit(1)

        monkeypatch.setattr(publish, "_upsert_with_retry", reject)
        monkeypatch.setattr(publish, "_fetch_existing_card", lambda cid: None)
        with pytest.raises(SystemExit):
            publish._upsert_run_card(_make_request(), "card-xyz")

    def test_happy_path_passes_through_upsert_result(self, monkeypatch):
        # No race: _upsert_run_card returns the upsert result verbatim.
        monkeypatch.setattr(
            publish, "_upsert_with_retry",
            lambda req, timeout=15: [{"id": "row-1"}],
        )
        assert publish._upsert_run_card(_make_request(), "card-xyz") == [
            {"id": "row-1"}
        ]


# ---------------------------------------------------------------------------
# Production-write guard (audit C1) — publish_to_supabase must never silently
# write to the prod project without an explicit opt-in, and --dry-run must
# make NO network call at all.
# ---------------------------------------------------------------------------

@pytest.fixture
def no_network(monkeypatch):
    """Trip-wire: any network call (urlopen / get_session) fails the test.

    Used to PROVE a code path makes no network call — if the path tries to
    authenticate or POST, these explode instead of silently hitting Supabase.
    """
    def boom_urlopen(*a, **k):
        raise AssertionError("network call (urlopen) attempted — must not happen")

    def boom_session(*a, **k):
        raise AssertionError("get_session() called — must not authenticate")

    monkeypatch.setattr(urllib.request, "urlopen", boom_urlopen)
    monkeypatch.setattr(publish, "get_session", boom_session)


@pytest.fixture
def prod_target(monkeypatch):
    """Force _is_prod_target() True and clear any inherited prod opt-in."""
    monkeypatch.setattr(publish, "_is_prod_target", lambda: True)
    monkeypatch.delenv("MT_EVAL_ALLOW_PROD", raising=False)


class TestProdWriteGuard:
    """C1: prod writes require an explicit opt-in distinct from -y/--yes."""

    def test_optin_helpers(self, monkeypatch):
        monkeypatch.delenv("MT_EVAL_ALLOW_PROD", raising=False)
        assert publish._prod_write_opted_in() is False
        assert publish._prod_write_opted_in(yes_prod=True) is True
        monkeypatch.setenv("MT_EVAL_ALLOW_PROD", "1")
        assert publish._prod_write_opted_in() is True
        monkeypatch.setenv("MT_EVAL_ALLOW_PROD", "0")
        assert publish._prod_write_opted_in() is False

    def test_dry_run_makes_no_network_call(self, tmp_path, no_network, capsys):
        # --dry-run must assemble + print the payload but never authenticate
        # or POST. no_network trips on any network attempt.
        report_path = _write_pair(tmp_path, "dryrun")
        row = publish.publish_to_supabase(report_path, dry_run=True)

        assert isinstance(row, dict)
        assert row["id"]  # a real assembled card id
        out = capsys.readouterr().out
        assert "DRY RUN" in out
        assert "NOT published" in out

    def test_non_dry_prod_without_optin_refuses_no_network(
        self, tmp_path, prod_target, no_network, capsys
    ):
        # The dangerous one-keystroke path: a (non-dry) prod publish WITHOUT
        # the explicit opt-in must NOT contact Supabase and must exit non-zero.
        # auto_confirm=True simulates the `-y` reflex; it is NOT consent to prod.
        report_path = _write_pair(tmp_path, "noOptIn")
        with pytest.raises(SystemExit) as exc:
            publish.publish_to_supabase(
                report_path, auto_confirm=True, dry_run=False
            )
        assert exc.value.code != 0
        out = capsys.readouterr().out
        assert "Refusing to write to PRODUCTION" in out
        assert "--dry-run" in out

    def test_non_dry_prod_with_flag_optin_proceeds(
        self, tmp_path, prod_target, monkeypatch
    ):
        # With the explicit --prod opt-in (yes_prod=True), the write proceeds:
        # it authenticates and upserts. We mock the client so no real network
        # I/O happens, then assert the upsert was reached.
        report_path = _write_pair(tmp_path, "withFlag")
        monkeypatch.setattr(
            publish, "get_session",
            lambda: {"access_token": "tok", "user": {"email": "t@example.com"}},
        )
        monkeypatch.setattr(publish, "get_submitter_name", lambda s: "tester")
        # No existing row → publish proceeds to the upsert.
        monkeypatch.setattr(publish, "_fetch_existing_card", lambda cid: None)
        upsert_calls = []

        def fake_upsert(req, card_id, timeout=15):
            upsert_calls.append(card_id)
            return [{"id": card_id}]

        monkeypatch.setattr(publish, "_upsert_run_card", fake_upsert)
        # The dataset-metadata upsert at the tail also hits the network — stub it.
        monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: _FakeResponse())

        result = publish.publish_to_supabase(
            report_path, auto_confirm=True, dry_run=False, yes_prod=True
        )
        assert len(upsert_calls) == 1
        assert result == [{"id": upsert_calls[0]}]

    def test_non_dry_prod_with_env_optin_proceeds(
        self, tmp_path, prod_target, monkeypatch
    ):
        # MT_EVAL_ALLOW_PROD=1 is an equally valid opt-in (CI / batch path).
        report_path = _write_pair(tmp_path, "withEnv")
        monkeypatch.setenv("MT_EVAL_ALLOW_PROD", "1")
        monkeypatch.setattr(
            publish, "get_session",
            lambda: {"access_token": "tok", "user": {"email": "t@example.com"}},
        )
        monkeypatch.setattr(publish, "get_submitter_name", lambda s: "tester")
        monkeypatch.setattr(publish, "_fetch_existing_card", lambda cid: None)
        upsert_calls = []
        monkeypatch.setattr(
            publish, "_upsert_run_card",
            lambda req, card_id, timeout=15: upsert_calls.append(card_id) or [{"id": card_id}],
        )
        monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: _FakeResponse())

        publish.publish_to_supabase(
            report_path, auto_confirm=True, dry_run=False
        )
        assert len(upsert_calls) == 1

    def test_dry_run_overrides_prod_optin_check(
        self, tmp_path, prod_target, no_network, capsys
    ):
        # A dry run is always allowed even against prod with no opt-in —
        # because it never writes.
        report_path = _write_pair(tmp_path, "dryProd")
        row = publish.publish_to_supabase(report_path, dry_run=True)
        assert isinstance(row, dict)
        out = capsys.readouterr().out
        assert "DRY RUN" in out
        # It should name PRODUCTION as the would-be target.
        assert "PRODUCTION" in out
