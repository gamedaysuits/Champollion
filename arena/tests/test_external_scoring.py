"""external_scoring.py — the third-party hypotheses scoring path.

Everything runs offline against the SYNTHETIC fixture pair in
tests/fixtures/contest_synthetic/ (invented qaa>qab toy language — the sovereign multisig
plan's synthetic-first rule; no real corpus content anywhere near tests).

The load-bearing guarantees:
  * exact alignment or a loud HypothesesFormatError — never partial scoring;
  * the claimed method card validates class/paradigm against the canonical
    vocabularies and carries the participant-claimed honesty note;
  * the produced RunLog/TestReport pair round-trips through the UNCHANGED
    publish.assemble_run_card contract (one scoring path, no drift);
  * telemetry is truthfully zero (no API ran), condition labels the lane.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mt_eval_harness import external_scoring as ext

FIXTURES = Path(__file__).parent / "fixtures" / "contest_synthetic"
DEV_CORPUS = FIXTURES / "corpus_dev.json"
BLIND_CORPUS = FIXTURES / "corpus_blind_refs.json"


def _dev_references() -> list[str]:
    data = json.loads(DEV_CORPUS.read_text(encoding="utf-8"))
    return [e["reference"] for e in data["entries"]]


def _write(tmp_path: Path, name: str, content: str) -> Path:
    p = tmp_path / name
    p.write_text(content, encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# load_hypotheses — formats and loud failures.
# ---------------------------------------------------------------------------

class TestLoadHypotheses:
    def test_id_keyed_json_dict(self, tmp_path):
        p = _write(tmp_path, "h.json", json.dumps({"0": "a", "1": "b"}))
        assert ext.load_hypotheses(p) == {"0": "a", "1": "b"}

    def test_wrapped_hypotheses_key(self, tmp_path):
        p = _write(tmp_path, "h.json",
                   json.dumps({"hypotheses": {"0": "a"}}))
        assert ext.load_hypotheses(p) == {"0": "a"}

    def test_list_of_objects(self, tmp_path):
        p = _write(tmp_path, "h.json", json.dumps(
            [{"id": 0, "hypothesis": "a"}, {"id": 1, "translation": "b"}]))
        assert ext.load_hypotheses(p) == {"0": "a", "1": "b"}

    def test_plain_text_lines(self, tmp_path):
        p = _write(tmp_path, "h.txt", "line one\nline two\n")
        assert ext.load_hypotheses(p) == ["line one", "line two"]

    @pytest.mark.parametrize("bad, name", [
        ("not json {", "h.json"),
        ("{}", "h.json"),
        ("[]", "h.json"),
        ("", "h.txt"),
        (json.dumps([{"no_id": 1}]), "h.json"),
        (json.dumps([{"id": 0, "wrong_field": "x"}]), "h.json"),
        (json.dumps([{"id": 0, "hypothesis": "a"},
                     {"id": 0, "hypothesis": "b"}]), "h.json"),  # dup id
        (json.dumps({"0": 42}), "h.json"),  # non-string hypothesis
    ])
    def test_bad_files_fail_loud(self, tmp_path, bad, name):
        p = _write(tmp_path, name, bad)
        with pytest.raises(ext.HypothesesFormatError):
            ext.load_hypotheses(p)

    def test_missing_file_fails_loud(self, tmp_path):
        with pytest.raises(ext.HypothesesFormatError):
            ext.load_hypotheses(tmp_path / "nope.json")


# ---------------------------------------------------------------------------
# align_hypotheses — exact coverage or nothing.
# ---------------------------------------------------------------------------

class TestAlign:
    ENTRIES = [{"id": 0}, {"id": 1}, {"id": 2}]

    def test_line_aligned_exact(self):
        assert ext.align_hypotheses(self.ENTRIES, ["a", "b", "c"]) == \
            ["a", "b", "c"]

    def test_line_count_mismatch(self):
        with pytest.raises(ext.HypothesesFormatError, match="count mismatch"):
            ext.align_hypotheses(self.ENTRIES, ["a", "b"])

    def test_id_keyed_reordered(self):
        assert ext.align_hypotheses(
            self.ENTRIES, {"2": "c", "0": "a", "1": "b"}) == ["a", "b", "c"]

    def test_id_missing(self):
        with pytest.raises(ext.HypothesesFormatError, match="missing"):
            ext.align_hypotheses(self.ENTRIES, {"0": "a", "1": "b"})

    def test_id_unknown_extra(self):
        with pytest.raises(ext.HypothesesFormatError, match="unknown"):
            ext.align_hypotheses(
                self.ENTRIES, {"0": "a", "1": "b", "2": "c", "9": "x"})


# ---------------------------------------------------------------------------
# The claimed method card — canonical vocabulary + honesty note.
# ---------------------------------------------------------------------------

class TestClaimedMethodCard:
    def test_valid_claim(self):
        card = ext.build_claimed_method_card(
            system_label="acme-nmt-v2", method_class="pipeline",
            paradigm="neural-nmt")
        assert card["class"] == "pipeline"
        assert card["paradigm"] == "neural-nmt"
        assert "PARTICIPANT-CLAIMED" in card["provenance_note"]
        assert card["submission_lane"] == "hypotheses"

    def test_paradigm_defaults_unknown(self):
        card = ext.build_claimed_method_card(
            system_label="x", method_class="api")
        assert card["paradigm"] == "unknown"

    def test_invalid_class_rejected(self):
        with pytest.raises(ValueError, match="canonical"):
            ext.build_claimed_method_card(
                system_label="x", method_class="magic")

    def test_invalid_paradigm_rejected(self):
        with pytest.raises(ValueError, match="canonical"):
            ext.build_claimed_method_card(
                system_label="x", method_class="api", paradigm="quantum")

    def test_anonymous_rejected(self):
        with pytest.raises(ValueError, match="name"):
            ext.build_claimed_method_card(
                system_label="  ", method_class="api")


# ---------------------------------------------------------------------------
# score_hypotheses — the end-to-end round trip on the synthetic fixture.
# ---------------------------------------------------------------------------

def _score(tmp_path, hypotheses_lines, corpus=DEV_CORPUS, **overrides):
    tmp_path.mkdir(parents=True, exist_ok=True)
    hyp = _write(tmp_path, "hyps.txt", "\n".join(hypotheses_lines) + "\n")
    kwargs = dict(
        corpus_path=corpus,
        hypotheses_path=hyp,
        dataset_id="eval-qaa-qab-synth-dev-v1",
        source_lang="Synthetic A (qaa)",
        target_lang="Synthetic B (qab)",
        system_label="acme-nmt-v2",
        method_class="pipeline",
        paradigm="neural-nmt",
        output_dir=tmp_path / "out",
        compute_ci=False,
        submission={"contest_id": "synth-open-2026",
                    "intake_id": "intake-test",
                    "submitted_by": "participant@example.test"},
    )
    kwargs.update(overrides)
    return ext.score_hypotheses(**kwargs)


class TestScoreHypotheses:
    def test_perfect_hypotheses_round_trip(self, tmp_path):
        result = _score(tmp_path, _dev_references())
        assert result["evaluated"] == 6
        assert result["exact_match_rate"] == 1.0
        assert result["chrf_plus_plus"] == pytest.approx(100.0)
        assert result["composite"] is not None
        # 0–100 qualifier scale is the composite × 100 (one conversion point).
        assert result["qualifier_score"] == \
            pytest.approx(result["composite"] * 100, abs=0.01)
        # Both halves of the file contract exist for assemble_run_card reuse.
        assert Path(result["run_log_path"]).exists()
        assert Path(result["report_path"]).exists()

    def test_wrong_hypotheses_score_lower(self, tmp_path):
        perfect = _score(tmp_path, _dev_references())
        wrong = _score(tmp_path / "w", ["zzz qqq"] * 6)
        assert wrong["exact_match_rate"] == 0.0
        assert wrong["qualifier_score"] < perfect["qualifier_score"]

    def test_partial_coverage_never_scores(self, tmp_path):
        with pytest.raises(ext.HypothesesFormatError):
            _score(tmp_path, _dev_references()[:4])

    def test_run_log_is_honest(self, tmp_path):
        result = _score(tmp_path, _dev_references())
        run_log = json.loads(
            Path(result["run_log_path"]).read_text(encoding="utf-8"))
        config = run_log["config"]
        # The lane labels itself — a reader can never mistake this for a live run.
        assert config["prompt_version"] == ext.HYPOTHESES_CONDITION
        assert config["provider"] == "external"
        assert config["model"] == "acme-nmt-v2"
        # Telemetry is truthfully zero: no API was called.
        assert run_log["total_cost_usd"] == 0.0
        assert all(r["cost_usd"] == 0.0 and r["latency_s"] == 0
                   for r in run_log["results"])
        assert all(r["metadata"]["external_hypotheses"]
                   for r in run_log["results"])
        # Provenance: digests + submission identity, honesty note on the card.
        prov = run_log["provenance"]
        assert len(prov["hypotheses_sha256"]) == 64
        assert len(prov["corpus_sha256"]) == 64
        assert prov["submission_lane"] == "hypotheses"
        assert prov["submission"]["contest_id"] == "synth-open-2026"
        assert "PARTICIPANT-CLAIMED" in prov["method_card"]["provenance_note"]

    def test_assembled_card_carries_lane_and_claim(self, tmp_path):
        from mt_eval_harness.publish import assemble_run_card
        result = _score(tmp_path, _dev_references())
        card, card_uuid, fingerprint = assemble_run_card(result["report_path"])
        assert card["condition"] == ext.HYPOTHESES_CONDITION
        assert card["model_slug"] == "acme-nmt-v2"
        assert card["method_card"]["class"] == "pipeline"
        assert card["dataset"]["id"] == "eval-qaa-qab-synth-dev-v1"
        assert card_uuid == result["run_card_uuid"]
        assert fingerprint == result["fingerprint_hash"]

    def test_blind_corpus_held_out_segment(self, tmp_path):
        data = json.loads(BLIND_CORPUS.read_text(encoding="utf-8"))
        refs = [e["reference"] for e in data["entries"]]
        result = _score(tmp_path, refs, corpus=BLIND_CORPUS,
                        dataset_id="eval-qaa-qab-synth-blindtest-v1")
        run_log = json.loads(
            Path(result["run_log_path"]).read_text(encoding="utf-8"))
        assert all(r["segment"] == "held_out" for r in run_log["results"])

    def test_id_keyed_json_submission(self, tmp_path):
        refs = _dev_references()
        hyp = _write(tmp_path, "hyps.json", json.dumps(
            {str(i): refs[i] for i in reversed(range(6))}))
        result = _score(tmp_path, [], overrides=None) if False else \
            ext.score_hypotheses(
                corpus_path=DEV_CORPUS, hypotheses_path=hyp,
                dataset_id="eval-qaa-qab-synth-dev-v1",
                source_lang="Synthetic A (qaa)",
                target_lang="Synthetic B (qab)",
                system_label="acme-nmt-v2", method_class="pipeline",
                output_dir=tmp_path / "out", compute_ci=False)
        assert result["exact_match_rate"] == 1.0
