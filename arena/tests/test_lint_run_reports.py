"""Tests for scripts/lint_run_reports.py — the run-report integrity linter.

Covers each check family with synthetic fixtures, and pins the linter's
independently re-derived publish fingerprint (BENCHMARK_SPEC §3.8) against
mt_eval_harness.publish.assemble_run_card so drift in either implementation
is caught here.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

ARENA_ROOT = Path(__file__).resolve().parent.parent
LINTER = ARENA_ROOT / "scripts" / "lint_run_reports.py"


# ---------------------------------------------------------------------------
# Fixture builders
# ---------------------------------------------------------------------------

def build_corpus(path: Path, n: int = 4) -> str:
    """Write a tiny synthetic corpus file; returns its sha256."""
    entries = [
        {"id": f"fix_{i}", "source": f"sentence {i}", "reference": f"lause {i}"}
        for i in range(n)
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(entries), encoding="utf-8")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_registry(path: Path, corpus_sha: str, size: int = 4) -> Path:
    registry = {
        "registry_version": "1.0.0",
        "datasets": [
            {
                "id": "fixture-dev-v1",
                "aliases": ["fixture-dev"],
                "language_pair": {"source": "eng", "target": "fin"},
                "size": size,
                "access": "local",
                "license": "CC-BY-2.0",
                "path": "curated/fixture-dev-v1.json",
                "sha256": corpus_sha,
                "segment": "development",
            },
            {
                "id": "fixture-quarantined",
                "name": "QUARANTINED: poisoned.json",
                "access": "quarantined",
                "quarantine": True,
                "notes": "overlaps sealed gold standard; lives at quarantine/poisoned.json",
            },
        ],
    }
    path.write_text(json.dumps(registry), encoding="utf-8")
    return path


def build_pair(directory: Path, stem: str, corpus_path: Path, corpus_sha: str,
               n_ok: int = 3, n_err: int = 1, **overrides) -> tuple[Path, Path]:
    """Write an internally consistent run log + report pair (tester.py
    aggregate semantics: averages over non-error entries only)."""
    config = {
        "dataset": "all",
        "dataset_id": "",
        "entry_ids": None,
        "corpus_path": str(corpus_path),
        "source_lang": "English",
        "target_lang": "Finnish",
        "model": "test/model-1",
        "_model_id": "test/model-1",
        "prompt_version": "naive",
        "batch_size": 25,
        "tools_enabled": False,
        "temperature": 0.0,
        "_effective_temperature": 0.01,
        "_config_hash": "cafe12345678",
        "champollion_config_path": None,
    }
    config.update(overrides.pop("config", {}))

    chrf_values = [80.0, 60.0, 40.0][:n_ok]
    entries, results = [], []
    for i in range(n_ok + n_err):
        is_err = i >= n_ok
        base = {
            "id": f"fix_{i}",
            "source": f"sentence {i}",
            "expected": f"lause {i}",
            "raw_predicted": "lause 0" if not is_err else "[ERROR: boom]",
            "predicted": "lause 0" if not is_err else "[ERROR: boom]",
            "segment": "",
            "difficulty": "1",
            "latency_s": 0.05,
            "cost_usd": 0.0001,
            "tool_call_count": 0,
            "error": None if not is_err else "HTTP 500: boom",
        }
        results.append(dict(base))
        entries.append({
            **base,
            "domain": "",
            "exact_match": i == 0,
            "chrf_score": 0.0 if is_err else chrf_values[i],
            "bleu_score": 0.0 if is_err else chrf_values[i] - 10,
        })

    evaluated = n_ok
    exact = 1 if n_ok else 0
    overall = {
        "total_entries": n_ok + n_err,
        "error_count": n_err,
        "evaluated": evaluated,
        "exact_match_count": exact,
        "exact_match_rate": round(exact / evaluated, 4) if evaluated else 0.0,
        "miss_count": evaluated - exact,
        "miss_rate": round((evaluated - exact) / evaluated, 4) if evaluated else 0.0,
        "comet_score": None,
        "plugin_metrics": {},
    }
    if evaluated:
        overall["avg_chrf"] = round(sum(chrf_values) / evaluated, 2)
        overall["avg_bleu"] = round(sum(v - 10 for v in chrf_values) / evaluated, 2)
        overall["avg_latency_s"] = 0.05
        overall["total_cost_usd"] = round(0.0001 * evaluated, 4)
        overall["corpus_chrf"] = round(sum(chrf_values) / evaluated, 1)
        overall["corpus_bleu"] = round(sum(v - 10 for v in chrf_values) / evaluated, 1)
    overall.update(overrides.pop("overall", {}))

    by_segment = {
        "unknown": {
            "name": "unknown",
            "count": n_ok + n_err,
            "exact_match_count": exact,
            "miss_count": evaluated - exact,
            "error_count": n_err,
            "avg_chrf": overall.get("avg_chrf", 0.0),
            "avg_bleu": overall.get("avg_bleu", 0.0),
            "plugin_aggregates": {},
        }
    }

    provenance = {
        "system_prompt_used": "You are a translator.",
        "system_prompt_sha256": "f" * 64,
        "corpus_sha256": corpus_sha,
        "dataset_meta": {},
    }
    provenance.update(overrides.pop("provenance", {}))

    run = {
        "harness_version": "0.1.0",
        "run_id": stem,
        "config": dict(config),
        "timestamp_start": "2026-06-12T00:00:00+00:00",
        "timestamp_end": "2026-06-12T00:01:00+00:00",
        "elapsed_s": 60.0,
        "total_entries": n_ok + n_err,
        "cache_hits": 0,
        "total_cost_usd": overall.get("total_cost_usd", 0.0),
        "provenance": provenance,
        "results": results,
    }
    run.update(overrides.pop("run", {}))

    report = {
        "run_id": stem,
        "config": dict(config),
        "overall": overall,
        "by_segment": by_segment,
        "by_difficulty": {},
        "by_domain": {},
        "entries": entries,
    }
    report.update(overrides.pop("report", {}))
    assert not overrides, f"unused overrides: {overrides}"

    directory.mkdir(parents=True, exist_ok=True)
    run_path = directory / f"{stem}.json"
    report_path = directory / f"{stem}_report.json"
    run_path.write_text(json.dumps(run), encoding="utf-8")
    report_path.write_text(json.dumps(report), encoding="utf-8")
    return run_path, report_path


@pytest.fixture()
def workspace(tmp_path):
    corpus = tmp_path / "datasets" / "curated" / "fixture-dev-v1.json"
    corpus_sha = build_corpus(corpus)
    registry = build_registry(tmp_path / "registry.json", corpus_sha)
    reports = tmp_path / "reports"
    reports.mkdir()
    return {"tmp": tmp_path, "corpus": corpus, "corpus_sha": corpus_sha,
            "registry": registry, "reports": reports}


def lint(workspace, *extra_args) -> tuple[int, dict]:
    proc = subprocess.run(
        [sys.executable, str(LINTER), str(workspace["reports"]),
         "--registry", str(workspace["registry"]), "--json", *extra_args],
        capture_output=True, text=True,
    )
    payload = json.loads(proc.stdout) if proc.stdout.strip() else {}
    return proc.returncode, payload


def findings_for(payload: dict, check: str) -> list[dict]:
    return [f for f in payload.get("findings", []) if f["check"] == check]


# ---------------------------------------------------------------------------
# Clean baseline
# ---------------------------------------------------------------------------

def test_clean_pair_passes(workspace):
    build_pair(workspace["reports"], "run_20260612_000001_test_naive_all_b25",
               workspace["corpus"], workspace["corpus_sha"])
    code, payload = lint(workspace)
    errors = [f for f in payload["findings"] if f["severity"] == "ERROR"]
    assert errors == []
    assert code == 0
    # the synthetic run has one errored entry -> partial WARN, small corpus WARN
    assert findings_for(payload, "partial")
    assert findings_for(payload, "small-corpus")


def test_strict_promotes_warnings(workspace):
    build_pair(workspace["reports"], "run_20260612_000001_test_naive_all_b25",
               workspace["corpus"], workspace["corpus_sha"])
    code, _ = lint(workspace, "--strict")
    assert code == 1


def test_no_reports_exits_2(workspace):
    code, _ = lint(workspace)
    assert code == 2


# ---------------------------------------------------------------------------
# Score integrity
# ---------------------------------------------------------------------------

def test_tampered_average_fails(workspace):
    build_pair(workspace["reports"], "run_20260612_000002_test_naive_all_b25",
               workspace["corpus"], workspace["corpus_sha"],
               overall={"avg_chrf": 75.0})  # true mean is 60.0
    code, payload = lint(workspace)
    assert code == 1
    assert any("avg_chrf" in f["message"] for f in findings_for(payload, "aggregates"))


def test_out_of_range_entry_score_fails(workspace):
    _, report_path = build_pair(
        workspace["reports"], "run_20260612_000003_test_naive_all_b25",
        workspace["corpus"], workspace["corpus_sha"])
    report = json.loads(report_path.read_text())
    report["entries"][0]["chrf_score"] = 140.0
    report_path.write_text(json.dumps(report))
    code, payload = lint(workspace)
    assert code == 1
    assert findings_for(payload, "score-range")


def test_count_mismatch_fails(workspace):
    build_pair(workspace["reports"], "run_20260612_000004_test_naive_all_b25",
               workspace["corpus"], workspace["corpus_sha"],
               overall={"evaluated": 2})  # 2 + 1 error != 4 total
    code, payload = lint(workspace)
    assert code == 1
    assert findings_for(payload, "counts")


def test_vacuous_run_fails(workspace):
    build_pair(workspace["reports"], "run_20260612_000005_test_naive_all_b25",
               workspace["corpus"], workspace["corpus_sha"], n_ok=0, n_err=4)
    code, payload = lint(workspace)
    assert code == 1
    assert findings_for(payload, "vacuous")


def test_terminology_null_contract(workspace):
    build_pair(workspace["reports"], "run_20260612_000006_test_naive_all_b25",
               workspace["corpus"], workspace["corpus_sha"],
               overall={"plugin_metrics": {"terminology": {
                   "avg_terminology_adherence": None,
                   "total_term_matches": 5, "total_term_total": 9,
                   "total_term_misses": 4}}})
    code, payload = lint(workspace)
    assert code == 1
    assert any("terminology" in f["message"]
               for f in findings_for(payload, "null-handling"))


# ---------------------------------------------------------------------------
# Corpus identity and eligibility
# ---------------------------------------------------------------------------

def test_quarantined_corpus_fails(workspace):
    poisoned = workspace["tmp"] / "quarantine" / "poisoned.json"
    sha = build_corpus(poisoned)
    build_pair(workspace["reports"], "run_20260612_000007_test_naive_all_b25",
               poisoned, sha)
    code, payload = lint(workspace)
    assert code == 1
    assert any("QUARANTINED" in f["message"]
               for f in findings_for(payload, "corpus-eligibility"))


def test_dataset_misattribution_fails(workspace):
    poisoned = workspace["tmp"] / "quarantine" / "poisoned.json"
    sha = build_corpus(poisoned)
    build_pair(workspace["reports"], "run_20260612_000008_test_naive_all_b25",
               poisoned, sha, config={"dataset_id": "fixture-dev-v1"})
    code, payload = lint(workspace)
    assert code == 1
    assert any("never executed against" in f["message"]
               for f in findings_for(payload, "corpus-identity"))
    # eligibility judged on the actual file, not the declared id
    assert findings_for(payload, "corpus-eligibility")


def test_registry_sha_mismatch_fails(workspace):
    build_pair(workspace["reports"], "run_20260612_000009_test_naive_all_b25",
               workspace["corpus"], "0" * 64)
    code, payload = lint(workspace)
    assert code == 1
    messages = [f["message"] for f in findings_for(payload, "corpus-identity")]
    assert any("registry sha256" in m for m in messages)
    assert any("corpus file changed" in m for m in messages)


def test_cross_run_sha_drift_fails(workspace):
    build_pair(workspace["reports"], "run_20260612_000010_test_naive_all_b25",
               workspace["corpus"], workspace["corpus_sha"])
    drifted = dict(provenance={"corpus_sha256": "1" * 64})
    build_pair(workspace["reports"], "run_20260612_000011_test_naive_all_b25",
               workspace["corpus"], workspace["corpus_sha"], **drifted)
    code, payload = lint(workspace)
    assert code == 1
    assert any("distinct corpus_sha256" in f["message"]
               for f in findings_for(payload, "corpus-identity"))


# ---------------------------------------------------------------------------
# Pair corruption (log-filename collisions)
# ---------------------------------------------------------------------------

def test_pair_corruption_fails_and_suppresses_cascade(workspace):
    run_path, _ = build_pair(
        workspace["reports"], "run_20260612_000012_test_naive_all_b25",
        workspace["corpus"], workspace["corpus_sha"])
    run = json.loads(run_path.read_text())
    run["config"]["_config_hash"] = "deadbeef0000"
    run["provenance"]["corpus_sha256"] = "2" * 64  # other run's corpus
    run_path.write_text(json.dumps(run))
    code, payload = lint(workspace)
    assert code == 1
    assert any("DIFFERENT runs" in f["message"] for f in findings_for(payload, "pair"))
    # the foreign provenance must NOT cascade into corpus-identity findings
    assert findings_for(payload, "corpus-identity") == []
    assert payload["fingerprints"] == {}


# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------

def test_condition_mislabel_warns(workspace):
    build_pair(workspace["reports"], "run_20260612_000013_test_naive_all_b25",
               workspace["corpus"], workspace["corpus_sha"],
               provenance={"coaching_prompt": "use these terms..."})
    code, payload = lint(workspace)
    assert code == 0  # warning, not error
    assert any("relabel" in f["message"] for f in findings_for(payload, "condition"))


def test_model_fragmentation_warns(workspace):
    build_pair(workspace["reports"], "run_20260612_000014_test_naive_all_b25",
               workspace["corpus"], workspace["corpus_sha"])
    build_pair(workspace["reports"], "run_20260612_000015_test_naive_all_b25",
               workspace["corpus"], workspace["corpus_sha"],
               config={"model": "model-1"})  # same _model_id, second slug
    _, payload = lint(workspace)
    assert findings_for(payload, "model-frag")


# ---------------------------------------------------------------------------
# Fingerprint parity with the real publish pipeline
# ---------------------------------------------------------------------------

def test_fingerprint_parity_with_publish(workspace):
    stem = "run_20260612_000016_test_naive_all_b25"
    _, report_path = build_pair(workspace["reports"], stem,
                                workspace["corpus"], workspace["corpus_sha"])
    from mt_eval_harness.publish import assemble_run_card
    _card, _cid, harness_fp = assemble_run_card(report_path)
    _, payload = lint(workspace)
    assert payload["fingerprints"][stem] == harness_fp


def test_assembled_card_passes_and_tampering_is_caught(workspace, tmp_path):
    stem = "run_20260612_000017_test_naive_all_b25"
    _, report_path = build_pair(workspace["reports"], stem,
                                workspace["corpus"], workspace["corpus_sha"])
    from mt_eval_harness.publish import assemble_run_card
    card, _cid, _fp = assemble_run_card(report_path)

    clean = tmp_path / "card_clean.json"
    clean.write_text(json.dumps(card))
    code, payload = lint(workspace, "--cards", str(clean))
    assert findings_for(payload, "card") == []

    # Tampering with the composite (seal blanked so the composite check
    # itself, not just the tamper seal, must catch it).
    tampered_card = json.loads(json.dumps(card))
    tampered_card["scores"]["composite"] = min(
        1.0, (tampered_card["scores"]["composite"] or 0) + 0.2)
    tampered_card["run_card_hash"] = ""
    tampered = tmp_path / "card_tampered.json"
    tampered.write_text(json.dumps(tampered_card))
    code, payload = lint(workspace, "--cards", str(tampered))
    assert code == 1
    assert any("re-normalized" in f["message"] for f in findings_for(payload, "card"))

    # Any field edit after sealing must break the tamper seal.
    sealed_but_edited = json.loads(json.dumps(card))
    sealed_but_edited["scores"]["chrf_plus_plus"] = 99.9
    sealed = tmp_path / "card_sealed_edited.json"
    sealed.write_text(json.dumps(sealed_but_edited))
    code, payload = lint(workspace, "--cards", str(sealed))
    assert code == 1
    assert any("tamper seal" in f["message"] for f in findings_for(payload, "card"))
