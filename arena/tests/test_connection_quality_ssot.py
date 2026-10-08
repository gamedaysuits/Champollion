"""SSOT parity: the cq-v1 constants in connection_quality.py must equal the
cross-runtime SSOT shared/connection-quality.json.

This is the guard that makes shared/connection-quality.json the ONE authority
for the connection-quality numbers (the network map / route finder / cross-pair
leaderboard ordering currency): if someone edits a value in the JSON but not the
Python twin — or in the embedded standalone fallback but not the JSON — this
fails. The JS twin has its own mirror of this test
(cli/test/connection-quality-ssot.test.js). Wired into scripts/ssot_parity_gate.sh.
"""

import json
from pathlib import Path

import pytest

from mt_eval_harness import connection_quality as cq

_SSOT = Path(__file__).resolve().parents[2] / "shared" / "connection-quality.json"


@pytest.fixture(scope="module")
def ssot() -> dict:
    assert _SSOT.is_file(), f"SSOT not found at {_SSOT}"
    data = json.loads(_SSOT.read_text(encoding="utf-8"))
    return {k: v for k, v in data.items() if not k.startswith("_")}


def test_module_loaded_from_ssot_in_monorepo():
    """In-monorepo, the module must load the JSON, not the embedded fallback."""
    assert cq._CQ is not cq._CQ_FALLBACK, (
        "connection_quality loaded the standalone fallback instead of the shared "
        "JSON — the walk-up loader failed to find shared/connection-quality.json"
    )


def test_scalar_constants_match_ssot(ssot):
    scalars = [
        "N_FULL", "L_HEALTHY", "H_NOISE", "RUNS_FULL", "SIGNIFICANCE_N",
        "LAMBDA_JUNCTION", "W_METRIC_UNMEASURED", "COVER_BASE", "COVER_STEP",
        "COVER_DOMAIN_CAP", "COVER_REGISTER_CAP", "COVER_MIN",
        "RECENCY_FRESH_DAYS", "RECENCY_AGING_DAYS", "W_RECENCY_FRESH",
        "W_RECENCY_AGING", "W_RECENCY_STALE", "HUMAN_N_FULL",
        "HUMAN_REVIEWERS_FULL", "FORMULA_VERSION", "PROVENANCE",
    ]
    for name in scalars:
        got = getattr(cq, name)
        want = ssot[name]
        assert got == want, f"{name}: module {got!r} != SSOT {want!r}"
        assert type(got) is type(want), (
            f"{name}: module type {type(got).__name__} != SSOT type "
            f"{type(want).__name__}"
        )


def test_dict_constants_match_ssot(ssot):
    assert cq.W_CONTAM == ssot["W_CONTAM"]
    assert cq.W_TRUST == ssot["W_TRUST"]


def test_sequence_constants_match_ssot(ssot):
    # Tuples in Python, arrays in JSON — compare element-wise, order preserved.
    assert list(cq.BIN_EDGES) == ssot["BIN_EDGES"]
    assert list(cq.BIN_LABELS) == ssot["BIN_LABELS"]


def test_set_constants_match_ssot(ssot):
    assert set(cq.DOMAIN_NO_CREDIT) == set(ssot["DOMAIN_NO_CREDIT"])
    assert set(cq.DRIFT_EXEMPT_PARADIGMS) == set(ssot["DRIFT_EXEMPT_PARADIGMS"])


def test_derived_unknowns_track_ssot(ssot):
    # These are DERIVED in code, not stored — assert they derive correctly.
    assert cq.W_CONTAM_UNKNOWN == ssot["W_CONTAM"]["MEDIUM"]
    assert cq.W_TRUST_UNKNOWN == ssot["W_TRUST"]["unverified"]


def test_embedded_fallback_mirrors_ssot(ssot):
    """The standalone fallback must stay byte-equal to the SSOT so a
    monorepo-less pip install computes identical values."""
    assert cq._CQ_FALLBACK == ssot, (
        "connection_quality._CQ_FALLBACK has drifted from "
        "shared/connection-quality.json — update the fallback to match the SSOT"
    )
