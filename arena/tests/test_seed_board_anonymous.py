"""Tests for scripts/seed_board_anonymous.py — the founder-only, service-role
board-seeding lane (launch runbook §8).

No network: only row assembly/validation. The fixture RunLog + TestReport
pair is synthetic (mirrors tests/test_publish.py's minimal factories) — a
real report must never be committed, because its entries carry corpus text
and corpus content is never tracked in git (quarantine doctrine).
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ARENA_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ARENA_ROOT / "scripts" / "seed_board_anonymous.py"

from mt_eval_harness import publish  # noqa: E402


@pytest.fixture(scope="module")
def seed_mod():
    spec = importlib.util.spec_from_file_location(
        "seed_board_anonymous", SCRIPT,
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(autouse=True)
def no_git_provenance(monkeypatch):
    """Deterministic, fast assembly — skip git subprocess calls."""
    monkeypatch.setattr(publish, "_detect_git_provenance", lambda: None)


def _make_run_log() -> dict:
    return {
        "run_id": "seed_test_001",
        "harness_version": "9.0.0",
        "timestamp_start": "2026-01-01T00:00:00Z",
        "elapsed_s": 12.5,
        "total_cost_usd": 0.0123,
        "cache_hits": 0,
        "config": {
            "model": "test-provider/test-model",
            "prompt_version": "v1",
            "temperature": 0.0,
            "max_tokens": 1024,
            "batch_size": 25,
            "dataset_id": "seed_test_dataset",
            "source_lang": "English",
            "target_lang": "French",
            "tools_enabled": False,
        },
        "provenance": {
            "corpus_sha256": "a" * 64,
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


def _write_pair(dirpath: Path, name: str) -> Path:
    dirpath.mkdir(parents=True, exist_ok=True)
    run_log_path = dirpath / f"{name}.json"
    run_log_path.write_text(json.dumps(_make_run_log()), encoding="utf-8")
    report_path = dirpath / f"{name}_report.json"
    report_path.write_text(
        json.dumps(_make_report(str(run_log_path))), encoding="utf-8"
    )
    return report_path


def test_build_seed_row_shape(seed_mod, tmp_path):
    report_path = _write_pair(tmp_path, "run1")
    row = seed_mod.build_seed_row(report_path)

    assert row["submitter"] == "anonymous"
    assert row["trust"] == "unverified"
    assert "owner_uid" not in row          # NULL server-side, like the edge fn
    assert publish.validate_row(row) == []
    assert "runbook §8" in row["affirmation"]
    assert row["chrf_plus_plus"] == 55.0
    assert row["dataset_id"] == "seed_test_dataset"
    assert row["language_pair"]            # derived by assembly, non-empty


def test_seed_row_id_is_deterministic(seed_mod, tmp_path):
    """Same experiment → same fingerprint UUID → idempotent re-seeding."""
    row_a = seed_mod.build_seed_row(_write_pair(tmp_path / "a", "run1"))
    row_b = seed_mod.build_seed_row(_write_pair(tmp_path / "b", "run1"))
    assert row_a["id"] == row_b["id"]
    assert row_a["fingerprint_hash"] == row_b["fingerprint_hash"]


def test_find_reports_recurses_queue_layout(seed_mod, tmp_path):
    """Finds reports in the nested eval/logs/harness/queue/NNN_* layout."""
    d1 = tmp_path / "eval" / "logs" / "harness" / "queue" / "001_item"
    d2 = tmp_path / "eval" / "logs" / "harness" / "queue" / "002_item"
    r1 = _write_pair(d1, "runA")
    r2 = _write_pair(d2, "runB")
    found = seed_mod.find_reports(tmp_path)
    assert found == sorted([r1, r2])
    # RunLogs themselves are not picked up — reports only.
    assert all(p.name.endswith("_report.json") for p in found)


def test_missing_run_log_is_a_clean_error(seed_mod, tmp_path):
    """A report whose RunLog is gone raises FileNotFoundError (the CLI
    loop reports + skips it) — never a half-built row."""
    report_path = _write_pair(tmp_path, "run1")
    (tmp_path / "run1.json").unlink()
    with pytest.raises(FileNotFoundError):
        seed_mod.build_seed_row(report_path)
