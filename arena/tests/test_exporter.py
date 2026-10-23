"""
Tests for mt_eval_harness.exporter — a TestReport packaged as a champollion
method plugin, written as method/1 (2026-10-10).

Covers:
    - The method/1 document built from a TestReport (kind, model, decode,
      pairs, the run's chrF++ as evidence, provenance and card)
    - Checked by the shared method reader before anything is written
    - Coaching travels inside the plugin folder (coaching.dir, and a coached
      run's own coaching file as coaching.file), each file's sidecar with it
    - Provenance and commercial readiness flags
    - Error handling for missing/invalid inputs
"""

import json

import pytest

from mt_eval_harness.exporter import (
    KEBAB_CASE_RE,
    METHOD_SCHEMA_ID,
    VALID_METHOD_TYPES,
    ExportConfig,
    _build_manifest,
    _build_provenance,
    _check_method,
    _copy_coaching_data,
    _validate_report,
    export_plugin,
)
from mt_eval_harness.framework.method import read_method_document


# ---------------------------------------------------------------------------
# Fixtures — shared test data
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_report():
    """A minimal valid TestReport structure."""
    return {
        "run_id": "run_20260101_000000_x",
        "config": {
            "model": "google/gemini-3.8-flash",
            "run_name": "test-run-1",
            "timestamp_start": "2026-01-01T00:00:00Z",
            "batch_size": 5,
            "temperature": 0.3,
            "source_code": "eng",
            "target_code": "crk",
            "dataset_id": "eval-eng-crk-toy",
        },
        "overall": {
            "total_entries": 50,
            "exact_match_rate": 0.42,
            "exact_match_count": 21,
            "miss_rate": 0.58,
            "corpus_chrf": 68.5,
            "corpus_bleu": 35.2,
            "confidence_intervals": {"corpus_chrf": {"ci_lower": 61.0, "ci_upper": 74.2}},
        },
        "entries": [
            {
                "id": 1,
                "source": "zub",
                "expected": "mol",
                "predicted": "mol",
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
        _validate_report(sample_report)  # Should not raise

    def test_missing_overall_raises(self):
        with pytest.raises(ValueError, match="missing 'overall' key"):
            _validate_report({"entries": []})

    def test_runlog_detected(self):
        with pytest.raises(ValueError, match="RunLog"):
            _validate_report({"results": []})

    def test_error_message_mentions_mt_eval(self):
        with pytest.raises(ValueError, match="mt-eval test"):
            _validate_report({"results": []})


# ---------------------------------------------------------------------------
# Kebab-case validation (the plugin's name)
# ---------------------------------------------------------------------------

class TestKebabCaseRegex:
    @pytest.mark.parametrize("name", ["crk-v1", "french-formal-v2", "a", "test123", "0-start-with-digit"])
    def test_valid_names(self, name):
        assert KEBAB_CASE_RE.match(name), f"{name} should be valid"

    @pytest.mark.parametrize("name", ["CamelCase", "has spaces", "-leading-dash", "under_score", ""])
    def test_invalid_names(self, name):
        assert not KEBAB_CASE_RE.match(name), f"{name} should be invalid"


# ---------------------------------------------------------------------------
# The method/1 document
# ---------------------------------------------------------------------------

class TestBuildManifest:
    """_build_manifest — a TestReport as method/1."""

    def test_it_is_method_1_and_reads_as_such(self, sample_report, basic_config):
        doc = _build_manifest(sample_report, basic_config)
        assert doc["$schema"] == METHOD_SCHEMA_ID
        read = read_method_document(doc)
        assert read["version"] == 1 and read["errors"] == []
        assert _check_method(doc) == []

    def test_an_llm_run(self, sample_report, basic_config):
        doc = _build_manifest(sample_report, basic_config)
        assert doc["id"] == doc["name"] == "test-plugin-v1"
        assert doc["kind"] == "llm" and doc["model"] == "google/gemini-3.8-flash"
        assert doc["decode"] == {"temperature": 0.3, "batch_size": 5}
        assert doc["pairs"] == [{"source": "eng", "target": "crk"}]

    def test_a_provider_and_an_engine(self, sample_report, basic_config):
        basic_config.method_type = "anthropic"
        doc = _build_manifest(sample_report, basic_config)
        assert doc["kind"] == "llm" and doc["provider"] == "anthropic"
        basic_config.method_type = "deepl"
        doc = _build_manifest(sample_report, basic_config)
        assert doc["kind"] == "mt-api" and doc["engine"] == "deepl" and "model" not in doc

    def test_a_local_method_ships_through_the_local_model(self, sample_report, basic_config):
        # the CLI reads provider local as its type local; the exporter takes it too
        basic_config.method_type = "local"
        doc = _build_manifest(sample_report, basic_config)
        assert doc["kind"] == "llm" and doc["provider"] == "local"

    def test_an_api_method_is_refused_with_where_its_file_comes_from(self, sample_report, basic_config):
        basic_config.method_type = "api"
        with pytest.raises(ValueError, match="serve --emit-manifest"):
            _build_manifest(sample_report, basic_config)

    def test_the_runs_chrf_is_its_evidence(self, sample_report, basic_config):
        doc = _build_manifest(sample_report, basic_config)
        assert doc["evidence"] == [{
            "dataset": "eval-eng-crk-toy", "metric": "chrF++", "score": 68.5,
            "pair": {"source": "eng", "target": "crk"}, "ci": [61.0, 74.2], "n": 50,
            "date": "2026-01-01T00:00:00Z", "run": "run_20260101_000000_x"}]

    def test_a_gated_runs_evidence_says_so(self, sample_report, basic_config):
        sample_report["overall"]["gates"] = {"chain_id": "no-english", "fingerprint": "ab",
                                             "refusal_rate": 0.1}
        ev = _build_manifest(sample_report, basic_config)["evidence"][0]
        assert ev["x-gated"] == {"chain": "no-english", "fingerprint": "ab", "refusal_rate": 0.1}

    def test_no_chrf_no_evidence(self, sample_report, basic_config):
        del sample_report["overall"]["corpus_chrf"]
        assert "evidence" not in _build_manifest(sample_report, basic_config)

    def test_nothing_the_older_manifest_carried_is_lost(self, sample_report, basic_config):
        basic_config.register = "Standard written register"
        sample_report["overall"]["plugin_metrics"] = {"morphology": {"avg_validity_rate": 0.85}}
        doc = _build_manifest(sample_report, basic_config)
        assert doc["x-method-config"]["register"] == "Standard written register"
        bench = doc["x-benchmarks"]["crk"]
        assert bench["corpus_size"] == 50 and bench["exact_match_rate"] == 0.42
        assert bench["morphology.avg_validity_rate"] == 0.85

    def test_coaching_is_what_was_bundled(self, sample_report, basic_config):
        basic_config.method_type = "llm-coached"
        doc = _build_manifest(sample_report, basic_config, coaching_dir="coaching",
                              coaching_file="prompt/notes.md")
        assert doc["coaching"] == {"file": "prompt/notes.md", "dir": "coaching"}
        assert "coaching" not in _build_manifest(sample_report, basic_config)

    def test_descriptions(self, sample_report, basic_config):
        assert "mt-eval" in _build_manifest(sample_report, basic_config)["description"]
        basic_config.description = "Custom description"
        assert _build_manifest(sample_report, basic_config)["description"] == "Custom description"


# ---------------------------------------------------------------------------
# Provenance
# ---------------------------------------------------------------------------

class TestBuildProvenance:
    def test_default_not_commercial(self, basic_config):
        prov = _build_provenance(basic_config)
        assert prov["commercialReady"] is False
        assert "license-unclear" in prov["flags"]

    def test_commercial_ready_explicit(self, basic_config):
        basic_config.commercial_ready = True
        prov = _build_provenance(basic_config)
        assert prov["commercialReady"] is True
        assert prov["flags"] == []

    def test_resources_forwarded(self, basic_config):
        basic_config.provenance_resources = [{"name": "toy FST", "license": "Apache-2.0",
                                              "type": "morphological"}]
        prov = _build_provenance(basic_config)
        assert prov["resources"][0]["name"] == "toy FST"


# ---------------------------------------------------------------------------
# Coaching data
# ---------------------------------------------------------------------------

class TestCopyCoachingData:
    def test_copies_matching_locale_with_its_terms(self, tmp_path):
        source = tmp_path / "coaching_source"
        source.mkdir()
        (source / "crk.json").write_text('{"grammar_rules": []}')
        (source / "crk.json.champollion.json").write_text('{"transmission": "local-only"}')
        (source / "fr.json").write_text('{"grammar_rules": []}')
        plugin_dir = tmp_path / "plugin"
        plugin_dir.mkdir()
        assert _copy_coaching_data(str(source), plugin_dir, ["crk"]) is True
        assert (plugin_dir / "coaching" / "crk.json").exists()
        assert json.loads((plugin_dir / "coaching" / "crk.json.champollion.json").read_text()) == \
            {"transmission": "local-only"}, "the holders' terms travel with the file"
        assert not (plugin_dir / "coaching" / "fr.json").exists()

    def test_missing_locale_warns(self, tmp_path, capsys):
        source = tmp_path / "coaching_source"
        source.mkdir()
        plugin_dir = tmp_path / "plugin"
        plugin_dir.mkdir()
        assert _copy_coaching_data(str(source), plugin_dir, ["crk"]) is False
        assert "WARNING" in capsys.readouterr().out

    def test_missing_directory_warns(self, tmp_path, capsys):
        plugin_dir = tmp_path / "plugin"
        plugin_dir.mkdir()
        assert _copy_coaching_data("/nonexistent/path", plugin_dir, ["crk"]) is False
        assert "WARNING" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# End-to-end export
# ---------------------------------------------------------------------------

class TestExportPlugin:
    def test_basic_export(self, sample_report_file, basic_config):
        plugin_dir = export_plugin(sample_report_file, basic_config)
        doc = json.loads((plugin_dir / "method.json").read_text())
        assert doc["$schema"] == METHOD_SCHEMA_ID and doc["id"] == "test-plugin-v1"
        assert read_method_document(doc)["errors"] == []
        assert doc["written_by"].startswith("mt-eval export")

    def test_the_provider_it_was_measured_with_travels_with_it(self, sample_report, basic_config, tmp_path):
        """Docs review 2026-10-12 (#4): a method measured on a local model
        exported with no provider, and the CLI then ran it through OpenRouter."""
        for recorded, want in (("local", "local"), ("openrouter", "openrouter"), ("method-plugin", None)):
            report = json.loads(json.dumps(sample_report))
            report.setdefault("config", {})["provider"] = recorded
            src = tmp_path / f"report-{recorded}.json"
            src.write_text(json.dumps(report))
            config = ExportConfig(name=f"m-{recorded}-v1", method_type="llm", locales=["crk"],
                                  output_dir=str(tmp_path / recorded))
            doc = json.loads((export_plugin(src, config) / "method.json").read_text())
            assert doc.get("provider") == want, (recorded, doc.get("provider"))

    def test_missing_report_raises(self, basic_config):
        with pytest.raises(FileNotFoundError):
            export_plugin("/nonexistent/report.json", basic_config)

    def test_invalid_name_or_type_is_refused_before_writing(self, sample_report_file, tmp_path):
        for name, mtype, why in (("Invalid Name!", "llm", "kebab-case"), ("ok-v1", "nope", "Invalid type")):
            config = ExportConfig(name=name, method_type=mtype, locales=["crk"],
                                  output_dir=str(tmp_path / "out"))
            with pytest.raises(ValueError, match=why):
                export_plugin(sample_report_file, config)
        assert not (tmp_path / "out").exists()

    def test_runlog_rejected(self, tmp_path):
        runlog_path = tmp_path / "runlog.json"
        runlog_path.write_text(json.dumps({"results": []}))
        config = ExportConfig(name="test-v1", method_type="llm", locales=["crk"],
                              output_dir=str(tmp_path))
        with pytest.raises(ValueError, match="RunLog"):
            export_plugin(runlog_path, config)

    def test_a_coached_runs_coaching_travels_inside_the_plugin(self, sample_report, basic_config,
                                                                tmp_path):
        coaching = tmp_path / "coaching_src"
        coaching.mkdir()
        (coaching / "crk.json").write_text('{"grammar_rules": ["zub before mol"]}')
        prompt = tmp_path / "notes.md"
        prompt.write_text("Write plainly.")
        (tmp_path / "notes.md.champollion.json").write_text('{"transmission": "local-only"}')
        sample_report["config"]["coaching_file"] = str(prompt)
        report = tmp_path / "coached_report.json"
        report.write_text(json.dumps(sample_report))
        basic_config.method_type = "llm-coached"
        basic_config.coaching_dir = str(coaching)
        plugin_dir = export_plugin(report, basic_config)
        doc = json.loads((plugin_dir / "method.json").read_text())
        assert doc["kind"] == "llm-coached"
        assert doc["coaching"] == {"file": "prompt/notes.md", "dir": "coaching"}
        assert (plugin_dir / "coaching" / "crk.json").is_file()
        assert (plugin_dir / "prompt" / "notes.md").read_text() == "Write plainly."
        assert (plugin_dir / "prompt" / "notes.md.champollion.json").is_file()

    def test_a_coaching_file_not_on_this_machine_is_said(self, sample_report, basic_config,
                                                         tmp_path, capsys):
        sample_report["config"]["coaching_file"] = str(tmp_path / "gone.txt")
        report = tmp_path / "r.json"
        report.write_text(json.dumps(sample_report))
        basic_config.method_type = "llm-coached"
        plugin_dir = export_plugin(report, basic_config)
        assert "coaching" not in json.loads((plugin_dir / "method.json").read_text())
        assert "not on this machine" in capsys.readouterr().out

    def test_provenance_and_card(self, sample_report_file, basic_config):
        doc = json.loads((export_plugin(sample_report_file, basic_config) / "method.json").read_text())
        assert doc["card"] == {"commercial_ready": False}
        assert "license-unclear" in doc["provenance"]["flags"]

    def test_no_gds_in_output(self, sample_report_file, basic_config):
        raw = (export_plugin(sample_report_file, basic_config) / "method.json").read_text().lower()
        assert "gds" not in raw and "game day" not in raw

    def test_every_type_the_cli_names_is_handled(self):
        assert set(VALID_METHOD_TYPES) >= {"llm", "llm-coached", "api", "deepl"}
