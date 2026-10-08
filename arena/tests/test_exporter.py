"""
Tests for mt_eval_harness.exporter — plugin export to champollion format.

Covers:
    - Manifest generation from a TestReport
    - Champollion contract validation (required fields, valid types, kebab-case)
    - Provenance and commercial readiness flags
    - Coaching data copying and locale filtering
    - Error handling for missing/invalid inputs
    - Round-trip: export → read back → validate structure
"""

import json
import os
from pathlib import Path

import pytest

from mt_eval_harness.exporter import (
    ExportConfig,
    KEBAB_CASE_RE,
    REQUIRED_MANIFEST_FIELDS,
    VALID_METHOD_TYPES,
    _build_manifest,
    _build_provenance,
    _copy_coaching_data,
    _validate_manifest,
    _validate_report,
    export_plugin,
)


# ---------------------------------------------------------------------------
# Fixtures — shared test data
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_report():
    """A minimal valid TestReport structure."""
    return {
        "config": {
            "model": "gemini-2.5-flash",
            "run_name": "test-run-1",
            "timestamp_start": "2026-01-01T00:00:00Z",
            "batch_size": 5,
            "temperature": 0.3,
        },
        "overall": {
            "total_entries": 50,
            "exact_match_rate": 0.42,
            "exact_match_count": 21,
            "miss_rate": 0.58,
            "corpus_chrf": 68.5,
            "corpus_bleu": 35.2,
        },
        "entries": [
            {
                "id": 1,
                "source": "hello",
                "expected": "tân'si",
                "predicted": "tân'si",
                "exact_match": True,
                "chrf_score": 100.0,
            }
        ],
    }


@pytest.fixture
def sample_report_file(tmp_path, sample_report):
    """Write the sample report to a temp file and return its path."""
    p = tmp_path / "test_report.json"
    p.write_text(json.dumps(sample_report), encoding="utf-8")
    return p


@pytest.fixture
def basic_config(tmp_path):
    """A minimal valid ExportConfig."""
    return ExportConfig(
        name="test-plugin-v1",
        method_type="llm",
        locales=["crk"],
        output_dir=str(tmp_path),
    )


# ---------------------------------------------------------------------------
# Report validation
# ---------------------------------------------------------------------------

class TestValidateReport:
    """Tests for _validate_report — ensures only TestReports are accepted."""

    def test_valid_report_passes(self, sample_report):
        """A report with 'overall' key passes validation."""
        _validate_report(sample_report)  # Should not raise

    def test_missing_overall_raises(self):
        """Reports without 'overall' are rejected."""
        with pytest.raises(ValueError, match="missing 'overall' key"):
            _validate_report({"entries": []})

    def test_runlog_detected(self):
        """RunLogs (with 'results' key) get a specific error message."""
        with pytest.raises(ValueError, match="RunLog"):
            _validate_report({"results": []})

    def test_error_message_mentions_mt_eval(self):
        """Error message references 'mt-eval', not old 'gds-mt-eval'."""
        with pytest.raises(ValueError, match="mt-eval test"):
            _validate_report({"results": []})


# ---------------------------------------------------------------------------
# Manifest validation
# ---------------------------------------------------------------------------

class TestValidateManifest:
    """Tests for _validate_manifest — mirrors champollion's validateManifest()."""

    def test_valid_manifest(self):
        """A complete manifest passes with no errors."""
        manifest = {
            "name": "my-plugin-v1",
            "type": "llm",
            "version": "1.0.0",
            "locales": ["crk"],
        }
        assert _validate_manifest(manifest) == []

    def test_missing_required_fields(self):
        """Each missing required field produces an error."""
        errors = _validate_manifest({})
        for field_name in REQUIRED_MANIFEST_FIELDS:
            assert any(field_name in e for e in errors), f"Missing error for {field_name}"

    def test_invalid_type(self):
        """Invalid method types are rejected."""
        manifest = {
            "name": "test-v1",
            "type": "invalid-type",
            "version": "1.0.0",
            "locales": ["crk"],
        }
        errors = _validate_manifest(manifest)
        assert any("Invalid type" in e for e in errors)

    @pytest.mark.parametrize("valid_type", VALID_METHOD_TYPES)
    def test_all_valid_types_accepted(self, valid_type):
        """Every type in VALID_METHOD_TYPES passes validation."""
        manifest = {
            "name": "test-v1",
            "type": valid_type,
            "version": "1.0.0",
            "locales": ["crk"],
        }
        errors = _validate_manifest(manifest)
        type_errors = [e for e in errors if "type" in e.lower()]
        assert type_errors == []

    def test_non_kebab_name_rejected(self):
        """Names not in kebab-case are caught."""
        manifest = {
            "name": "MyPlugin V1",  # Spaces + uppercase
            "type": "llm",
            "version": "1.0.0",
            "locales": ["crk"],
        }
        errors = _validate_manifest(manifest)
        assert any("kebab-case" in e for e in errors)

    def test_api_without_endpoint(self):
        """API plugins must declare an endpoint."""
        manifest = {
            "name": "api-test-v1",
            "type": "api",
            "version": "1.0.0",
            "locales": ["crk"],
        }
        errors = _validate_manifest(manifest)
        assert any("endpoint" in e for e in errors)

    def test_api_with_endpoint_passes(self):
        """API plugins with an endpoint pass validation."""
        manifest = {
            "name": "api-test-v1",
            "type": "api",
            "version": "1.0.0",
            "locales": ["crk"],
            "endpoint": "https://translate.example.com",
        }
        errors = _validate_manifest(manifest)
        assert errors == []

    def test_locales_must_be_list(self):
        """Locales as a string (not array) is caught."""
        manifest = {
            "name": "test-v1",
            "type": "llm",
            "version": "1.0.0",
            "locales": "crk",  # Should be ["crk"]
        }
        errors = _validate_manifest(manifest)
        assert any("array" in e for e in errors)


# ---------------------------------------------------------------------------
# Kebab-case validation
# ---------------------------------------------------------------------------

class TestKebabCaseRegex:
    """Verify the kebab-case regex matches champollion's validation."""

    @pytest.mark.parametrize("name", [
        "crk-v1",
        "french-formal-v2",
        "a",
        "test123",
        "0-start-with-digit",
    ])
    def test_valid_names(self, name):
        assert KEBAB_CASE_RE.match(name), f"{name} should be valid"

    @pytest.mark.parametrize("name", [
        "CamelCase",
        "has spaces",
        "-leading-dash",
        "under_score",
        "",
    ])
    def test_invalid_names(self, name):
        assert not KEBAB_CASE_RE.match(name), f"{name} should be invalid"


# ---------------------------------------------------------------------------
# Manifest construction
# ---------------------------------------------------------------------------

class TestBuildManifest:
    """Tests for _build_manifest — mapping harness data to champollion schema."""

    def test_required_fields_present(self, sample_report, basic_config):
        manifest = _build_manifest(sample_report, basic_config)
        for field_name in REQUIRED_MANIFEST_FIELDS:
            assert field_name in manifest, f"Missing {field_name}"

    def test_name_matches_config(self, sample_report, basic_config):
        manifest = _build_manifest(sample_report, basic_config)
        assert manifest["name"] == "test-plugin-v1"

    def test_type_matches_config(self, sample_report, basic_config):
        manifest = _build_manifest(sample_report, basic_config)
        assert manifest["type"] == "llm"

    def test_locales_match_config(self, sample_report, basic_config):
        manifest = _build_manifest(sample_report, basic_config)
        assert manifest["locales"] == ["crk"]

    def test_model_in_config_block(self, sample_report, basic_config):
        manifest = _build_manifest(sample_report, basic_config)
        assert manifest["config"]["model"] == "gemini-2.5-flash"

    def test_batch_size_mapped(self, sample_report, basic_config):
        """batch_size from report becomes batchSize in manifest (camelCase)."""
        manifest = _build_manifest(sample_report, basic_config)
        assert manifest["config"]["batchSize"] == 5

    def test_temperature_included(self, sample_report, basic_config):
        manifest = _build_manifest(sample_report, basic_config)
        assert manifest["config"]["temperature"] == 0.3

    def test_register_included_when_set(self, sample_report, basic_config):
        basic_config.register = "Standard written register"
        manifest = _build_manifest(sample_report, basic_config)
        assert manifest["config"]["register"] == "Standard written register"

    def test_register_null_when_empty(self, sample_report, basic_config):
        """Register is null (not absent) when empty — canonical shape always includes all fields."""
        basic_config.register = ""
        manifest = _build_manifest(sample_report, basic_config)
        assert manifest["config"]["register"] is None

    def test_benchmarks_keyed_by_locale(self, sample_report, basic_config):
        manifest = _build_manifest(sample_report, basic_config)
        assert "crk" in manifest["benchmarks"]

    def test_benchmark_metrics(self, sample_report, basic_config):
        manifest = _build_manifest(sample_report, basic_config)
        bench = manifest["benchmarks"]["crk"]
        assert bench["corpus_size"] == 50
        assert bench["exact_match_rate"] == 0.42
        assert bench["corpus_chrf"] == 68.5
        assert bench["corpus_bleu"] == 35.2

    def test_multi_locale_benchmarks(self, sample_report, basic_config):
        """Each locale gets its own benchmark entry."""
        basic_config.locales = ["crk", "fr"]
        manifest = _build_manifest(sample_report, basic_config)
        assert "crk" in manifest["benchmarks"]
        assert "fr" in manifest["benchmarks"]

    def test_coaching_block_added_when_dir_set(self, sample_report, basic_config):
        basic_config.coaching_dir = "/some/path"
        manifest = _build_manifest(sample_report, basic_config)
        assert manifest["coaching"] == {"dir": "coaching"}

    def test_coaching_block_absent_when_no_dir(self, sample_report, basic_config):
        basic_config.coaching_dir = None
        manifest = _build_manifest(sample_report, basic_config)
        assert "coaching" not in manifest

    def test_description_default(self, sample_report, basic_config):
        """Default description references the mt-eval dist name (not gds-)."""
        basic_config.description = ""
        manifest = _build_manifest(sample_report, basic_config)
        assert "mt-eval" in manifest["description"]
        assert "gds" not in manifest["description"]

    def test_description_custom(self, sample_report, basic_config):
        basic_config.description = "Custom description"
        manifest = _build_manifest(sample_report, basic_config)
        assert manifest["description"] == "Custom description"

    def test_plugin_metrics_forwarded(self, sample_report, basic_config):
        """Plugin metrics from the harness are included with qualified keys."""
        sample_report["overall"]["plugin_metrics"] = {
            "morphology": {"avg_validity_rate": 0.85}
        }
        manifest = _build_manifest(sample_report, basic_config)
        bench = manifest["benchmarks"]["crk"]
        assert bench["morphology.avg_validity_rate"] == 0.85


# ---------------------------------------------------------------------------
# Provenance
# ---------------------------------------------------------------------------

class TestBuildProvenance:
    """Tests for _build_provenance — licensing safety defaults."""

    def test_default_not_commercial(self, basic_config):
        """Default provenance is license-unclear, not commercial."""
        prov = _build_provenance(basic_config)
        assert prov["commercialReady"] is False
        assert "license-unclear" in prov["flags"]

    def test_commercial_ready_explicit(self, basic_config):
        """When explicitly set, commercial flag is True and no flags."""
        basic_config.commercial_ready = True
        prov = _build_provenance(basic_config)
        assert prov["commercialReady"] is True
        assert prov["flags"] == []

    def test_resources_forwarded(self, basic_config):
        """Declared resources are included in provenance."""
        basic_config.provenance_resources = [
            {"name": "ALT-lab FST", "license": "Apache-2.0", "type": "morphological"}
        ]
        prov = _build_provenance(basic_config)
        assert len(prov["resources"]) == 1
        assert prov["resources"][0]["name"] == "ALT-lab FST"


# ---------------------------------------------------------------------------
# Coaching data
# ---------------------------------------------------------------------------

class TestCopyCoachingData:
    """Tests for _copy_coaching_data — locale-filtered coaching bundling."""

    def test_copies_matching_locale(self, tmp_path):
        """Coaching files matching declared locales are copied."""
        source = tmp_path / "coaching_source"
        source.mkdir()
        (source / "crk.json").write_text('{"examples": []}')
        (source / "fr.json").write_text('{"examples": []}')

        plugin_dir = tmp_path / "plugin"
        plugin_dir.mkdir()

        result = _copy_coaching_data(str(source), plugin_dir, ["crk"])

        assert result is True
        assert (plugin_dir / "coaching" / "crk.json").exists()
        # fr.json should NOT be copied — it's not in the declared locales
        assert not (plugin_dir / "coaching" / "fr.json").exists()

    def test_missing_locale_warns(self, tmp_path, capsys):
        """Missing coaching files for declared locales produce a warning."""
        source = tmp_path / "coaching_source"
        source.mkdir()
        # No crk.json exists

        plugin_dir = tmp_path / "plugin"
        plugin_dir.mkdir()

        result = _copy_coaching_data(str(source), plugin_dir, ["crk"])

        assert result is False
        captured = capsys.readouterr()
        assert "WARNING" in captured.out

    def test_missing_directory_warns(self, tmp_path, capsys):
        """Non-existent coaching directory produces a warning."""
        plugin_dir = tmp_path / "plugin"
        plugin_dir.mkdir()

        result = _copy_coaching_data("/nonexistent/path", plugin_dir, ["crk"])

        assert result is False
        captured = capsys.readouterr()
        assert "WARNING" in captured.out

    def test_multi_locale_copy(self, tmp_path):
        """Multiple locale files are copied when all exist."""
        source = tmp_path / "coaching_source"
        source.mkdir()
        (source / "crk.json").write_text('{}')
        (source / "fr.json").write_text('{}')

        plugin_dir = tmp_path / "plugin"
        plugin_dir.mkdir()

        result = _copy_coaching_data(str(source), plugin_dir, ["crk", "fr"])

        assert result is True
        assert (plugin_dir / "coaching" / "crk.json").exists()
        assert (plugin_dir / "coaching" / "fr.json").exists()


# ---------------------------------------------------------------------------
# End-to-end export
# ---------------------------------------------------------------------------

class TestExportPlugin:
    """Integration tests for export_plugin — full round-trip."""

    def test_basic_export(self, sample_report_file, basic_config):
        """Export produces a valid plugin directory with method.json."""
        plugin_dir = export_plugin(sample_report_file, basic_config)

        assert plugin_dir.is_dir()
        manifest_path = plugin_dir / "method.json"
        assert manifest_path.exists()

        manifest = json.loads(manifest_path.read_text())
        assert manifest["name"] == "test-plugin-v1"
        assert manifest["type"] == "llm"
        assert manifest["locales"] == ["crk"]

    def test_manifest_passes_champollion_validation(self, sample_report_file, basic_config):
        """The generated manifest passes our local champollion validator."""
        plugin_dir = export_plugin(sample_report_file, basic_config)
        manifest = json.loads((plugin_dir / "method.json").read_text())
        errors = _validate_manifest(manifest)
        assert errors == [], f"Validation errors: {errors}"

    def test_missing_report_raises(self, basic_config):
        """Exporting from a nonexistent file raises FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            export_plugin("/nonexistent/report.json", basic_config)

    def test_invalid_name_raises(self, sample_report_file, tmp_path):
        """An invalid plugin name (not kebab-case) is caught before writing."""
        config = ExportConfig(
            name="Invalid Name!",
            method_type="llm",
            locales=["crk"],
            output_dir=str(tmp_path),
        )
        with pytest.raises(ValueError, match="champollion validation"):
            export_plugin(sample_report_file, config)

    def test_runlog_rejected(self, tmp_path):
        """Passing a RunLog (not TestReport) is caught with a clear error."""
        runlog_path = tmp_path / "runlog.json"
        runlog_path.write_text(json.dumps({"results": []}))

        config = ExportConfig(
            name="test-v1",
            method_type="llm",
            locales=["crk"],
            output_dir=str(tmp_path),
        )
        with pytest.raises(ValueError, match="RunLog"):
            export_plugin(runlog_path, config)

    def test_coaching_bundled(self, sample_report_file, basic_config, tmp_path):
        """When coaching_dir is set and files exist, coaching is bundled."""
        coaching = tmp_path / "coaching_src"
        coaching.mkdir()
        (coaching / "crk.json").write_text('{"examples": ["hello → tân\'si"]}')

        basic_config.coaching_dir = str(coaching)
        plugin_dir = export_plugin(sample_report_file, basic_config)

        assert (plugin_dir / "coaching" / "crk.json").exists()
        manifest = json.loads((plugin_dir / "method.json").read_text())
        assert manifest.get("coaching") == {"dir": "coaching"}

    def test_version_string_forwarded(self, sample_report_file, basic_config):
        """Custom version string appears in the manifest."""
        basic_config.version = "2.3.1"
        plugin_dir = export_plugin(sample_report_file, basic_config)
        manifest = json.loads((plugin_dir / "method.json").read_text())
        assert manifest["version"] == "2.3.1"

    def test_provenance_defaults_safe(self, sample_report_file, basic_config):
        """By default, plugins are NOT commercially ready."""
        plugin_dir = export_plugin(sample_report_file, basic_config)
        manifest = json.loads((plugin_dir / "method.json").read_text())
        assert manifest["provenance"]["commercialReady"] is False
        assert "license-unclear" in manifest["provenance"]["flags"]

    def test_commercial_ready_when_set(self, sample_report_file, basic_config):
        """When commercial_ready is True, the flag is set correctly."""
        basic_config.commercial_ready = True
        plugin_dir = export_plugin(sample_report_file, basic_config)
        manifest = json.loads((plugin_dir / "method.json").read_text())
        assert manifest["provenance"]["commercialReady"] is True
        assert manifest["provenance"]["flags"] == []

    def test_no_gds_in_output(self, sample_report_file, basic_config):
        """Verify zero GDS branding in the exported manifest."""
        plugin_dir = export_plugin(sample_report_file, basic_config)
        raw = (plugin_dir / "method.json").read_text()
        assert "gds" not in raw.lower()
        assert "game day" not in raw.lower()
