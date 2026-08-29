"""qualifier_gate.py — semantics + cross-runtime parity with sealed-qualifier.mjs.

The gate's logic SSOT is cli/lib/sealed-qualifier.mjs (isEligibleForSealedRun);
mt_eval_harness/qualifier_gate.py is the hand-synced Python mirror the organizer
node runs. Like every cross-runtime mirror here (contamination lanes, queue
selection, method bridge), the two are kept honest by a parity test: one shared
vector set is evaluated by BOTH runtimes and the semantic fields must agree.

Prose `reason` strings are deliberately NOT compared (equivalent, not
char-identical); the compared surface is eligible / threshold / score / stale
/ badge{stale, ageYears, risk}.

The parity case skips cleanly when `node` or the monorepo cli/ tree is absent
(standalone pip install) — it is a monorepo dev/CI guard.
"""

from __future__ import annotations

import json
import math
import shutil
import subprocess
from pathlib import Path

import pytest

from mt_eval_harness import qualifier_gate as qg

# ---------------------------------------------------------------------------
# The shared vectors — every branch of the gate, including the fail-safe ones.
# ---------------------------------------------------------------------------
VECTORS = [
    # No qualifier paired at all -> fail-safe ineligible.
    {},
    {"qualifierId": None, "score": 99},
    # Qualifier exists but no recorded score -> ineligible.
    {"qualifierId": "eval-eng-xxx-sealed-qualifier-v2026"},
    {"qualifierId": "eval-eng-xxx-sealed-qualifier-v2026", "score": None},
    # Non-numeric score -> ineligible (JS NaN branch == Python None branch).
    {"qualifierId": "eval-eng-xxx-sealed-qualifier-v2026", "score": "not-a-number"},
    # Below threshold.
    {"qualifierId": "q", "score": 29.9, "threshold": 30},
    # Exactly at threshold -> eligible (the gate is `score < threshold` fails).
    {"qualifierId": "q", "score": 30, "threshold": 30},
    # Comfortably above, custom calibrated threshold.
    {"qualifierId": "q", "score": 55.5, "threshold": 42.5},
    # Fresh vintage: no staleness badge risk.
    {"qualifierId": "q", "score": 80, "threshold": 30,
     "qualifierYear": 2026, "currentYear": 2026},
    # One year stale -> MEDIUM; still gates on the score.
    {"qualifierId": "q", "score": 80, "threshold": 30,
     "qualifierYear": 2025, "currentYear": 2026},
    # Two+ years stale -> HIGH.
    {"qualifierId": "q", "score": 80, "threshold": 30,
     "qualifierYear": 2024, "currentYear": 2026},
    # Stale AND failing: ineligible with badge.
    {"qualifierId": "q", "score": 5, "threshold": 30,
     "qualifierYear": 2023, "currentYear": 2026},
]


def _py_eval(vector: dict) -> dict:
    return qg.is_eligible_for_sealed_run(
        qualifier_id=vector.get("qualifierId"),
        score=vector.get("score"),
        threshold=vector.get("threshold", qg.DEFAULT_QUALIFIER_THRESHOLD),
        qualifier_year=vector.get("qualifierYear"),
        current_year=vector.get("currentYear"),
    )


# ---------------------------------------------------------------------------
# Python-side semantics.
# ---------------------------------------------------------------------------

class TestGateSemantics:
    def test_fail_safe_without_qualifier(self):
        out = qg.is_eligible_for_sealed_run()
        assert out["eligible"] is False
        assert out["score"] is None

    def test_fail_safe_without_score(self):
        out = qg.is_eligible_for_sealed_run(qualifier_id="q")
        assert out["eligible"] is False

    def test_below_threshold_ineligible_at_threshold_eligible(self):
        below = qg.is_eligible_for_sealed_run(qualifier_id="q", score=29.999,
                                              threshold=30)
        at = qg.is_eligible_for_sealed_run(qualifier_id="q", score=30,
                                           threshold=30)
        assert below["eligible"] is False
        assert at["eligible"] is True

    def test_threshold_is_data_not_code(self):
        """A calibrated per-contest threshold overrides the floor placeholder."""
        out = qg.is_eligible_for_sealed_run(qualifier_id="q", score=40,
                                            threshold=42.5)
        assert out["eligible"] is False
        assert out["threshold"] == 42.5

    def test_stale_qualifier_still_gates_but_reports(self):
        out = qg.is_eligible_for_sealed_run(
            qualifier_id="q", score=80, threshold=30,
            qualifier_year=2024, current_year=2026)
        assert out["eligible"] is True
        assert out["stale"] is True
        assert out["badge"]["risk"] == "HIGH"

    def test_badge_vocabulary(self):
        fresh = qg.qualifier_contamination_badge(qualifier_year=2026,
                                                 current_year=2026)
        med = qg.qualifier_contamination_badge(qualifier_year=2025,
                                               current_year=2026)
        high = qg.qualifier_contamination_badge(qualifier_year=2020,
                                                current_year=2026)
        assert (fresh["risk"], med["risk"], high["risk"]) == \
            ("NONE", "MEDIUM", "HIGH")
        assert fresh["badge"] is None and med["stale"] and high["stale"]

    def test_version_helpers(self):
        assert qg.qualifier_version_tag(2026) == "v2026"
        assert qg.parse_qualifier_year("eval-eng-crk-x-qualifier-v2031") == 2031
        assert qg.parse_qualifier_year("no-year-here") is None
        assert qg.build_qualifier_id(source="eng", target="crk", slug="news",
                                     year=2026) \
            == "eval-eng-crk-news-qualifier-v2026"
        with pytest.raises(ValueError):
            qg.qualifier_version_tag(99)


# ---------------------------------------------------------------------------
# Cross-runtime parity — the drift guard.
# ---------------------------------------------------------------------------

def _mjs_path() -> Path | None:
    here = Path(__file__).resolve()
    for ancestor in here.parents:
        candidate = ancestor / "cli" / "lib" / "sealed-qualifier.mjs"
        if candidate.is_file():
            return candidate
    return None


def _js_eval_all(vectors: list[dict]) -> list[dict]:
    mjs = _mjs_path()
    if mjs is None:
        pytest.skip("cli/lib/sealed-qualifier.mjs not present "
                    "(standalone install without the monorepo cli/ tree)")
    if shutil.which("node") is None:
        pytest.skip("node not installed — cross-runtime parity needs it")
    script = (
        f"import {{ isEligibleForSealedRun }} from {json.dumps(mjs.as_uri())};\n"
        "let raw = '';\n"
        "for await (const chunk of process.stdin) raw += chunk;\n"
        "const out = JSON.parse(raw).map(v => isEligibleForSealedRun(v));\n"
        "process.stdout.write(JSON.stringify(out));\n"
    )
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        input=json.dumps(vectors), capture_output=True, text=True, timeout=60,
    )
    assert proc.returncode == 0, f"node parity run failed: {proc.stderr}"
    return json.loads(proc.stdout)


def _semantic(result: dict) -> dict:
    """The compared surface. JS NaN scores arrive as null via JSON — treat both
    runtimes' 'no usable score' as None; compare numbers as floats."""
    score = result.get("score")
    if isinstance(score, float) and math.isnan(score):
        score = None
    badge = result.get("badge")
    return {
        "eligible": result["eligible"],
        "threshold": float(result["threshold"]),
        "score": None if score is None else float(score),
        "stale": result["stale"],
        "badge": None if badge is None else {
            "stale": badge["stale"],
            "ageYears": badge["ageYears"],
            "risk": badge["risk"],
        },
    }


def test_parity_with_sealed_qualifier_mjs():
    js_results = _js_eval_all(VECTORS)
    py_results = [_py_eval(v) for v in VECTORS]
    assert len(js_results) == len(py_results) == len(VECTORS)
    for vector, js, py in zip(VECTORS, js_results, py_results):
        assert _semantic(js) == _semantic(py), (
            f"runtime drift on vector {vector}:\n  js={js}\n  py={py}")
