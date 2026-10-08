"""LYSS role-registry parity — roles.py ↔ metric-registry ↔ plugin envelopes.

The LYSS general layer (champollion_lyss/roles.py) defines the language-neutral
roles every per-language implementation fills. These tests pin the three-way
contract:

  1. roles.py card_key / canonical_metric agree with shared/metric-registry.json
  2. every CRK plugin aggregate carries the role envelope (lyss_role,
     lyss_version, lyss_canonical_metric)
  3. the legacy discovery flags still ride along (archived run cards and older
     harnesses discover by flag, not envelope)

Skips when the optional champollion-lyss package is not installed.
"""

from __future__ import annotations

import pytest

from mt_eval_harness.metric_manifest import metric_entries

lyss_roles = pytest.importorskip(
    "champollion_lyss.roles", reason="champollion-lyss not installed (optional)"
)


def _registry_by_card_key():
    entries = metric_entries()
    if not entries:
        pytest.skip("shared/metric-registry.json not found (standalone install)")
    return {e["card_key"]: (cid, e) for cid, e in entries.items() if e.get("card_key")}


def test_every_role_resolves_against_metric_registry():
    """Each LYSS role's card_key + canonical_metric must exist in the registry."""
    by_card_key = _registry_by_card_key()
    for role, spec in lyss_roles.ROLES.items():
        assert spec["card_key"] in by_card_key, (
            f"role '{role}' declares card_key '{spec['card_key']}' "
            f"which is not in shared/metric-registry.json"
        )
        canonical_id, _entry = by_card_key[spec["card_key"]]
        assert canonical_id == spec["canonical_metric"], (
            f"role '{role}': roles.py says canonical_metric="
            f"'{spec['canonical_metric']}' but the registry maps card_key "
            f"'{spec['card_key']}' to '{canonical_id}'"
        )


def test_registry_lyss_card_keys_all_have_roles():
    """Every lyss-* card_key in the registry must map to a defined role."""
    role_card_keys = {s["card_key"] for s in lyss_roles.ROLES.values()}
    for card_key, (cid, _e) in _registry_by_card_key().items():
        if card_key.startswith("lyss-"):
            assert card_key in role_card_keys, (
                f"registry metric '{cid}' declares LYSS card_key '{card_key}' "
                f"but roles.py defines no such role"
            )


@pytest.mark.parametrize(
    "cls_name,role",
    [("CrkLinterMetric", "eq"), ("CrkSemanticMetric", "sem"), ("CrkLintedChrF", "chrf")],
)
def test_crk_aggregates_carry_role_envelope(cls_name, role):
    """Empty-input aggregate must still carry the full role envelope."""
    from champollion_lyss.crk import metrics as crk_metrics

    plugin = getattr(crk_metrics, cls_name)()
    agg = plugin.aggregate([])
    assert agg.get("lyss_role") == role, f"{cls_name}: missing/wrong lyss_role"
    assert agg.get("lyss_version"), f"{cls_name}: missing lyss_version"
    assert (
        agg.get("lyss_canonical_metric")
        == lyss_roles.ROLES[role]["canonical_metric"]
    ), f"{cls_name}: canonical metric mismatch"


def test_eq_aggregate_keeps_legacy_discovery_flag():
    """Back-compat contract: envelope is ADDITIVE, the legacy flag stays."""
    from champollion_lyss.crk.metrics import CrkLinterMetric

    agg = CrkLinterMetric().aggregate([])
    assert agg.get("is_equivalence_linter") is True, (
        "is_equivalence_linter must keep riding alongside the role envelope — "
        "archived run cards and older harnesses discover by this flag"
    )


def test_envelope_rejects_unknown_role():
    with pytest.raises(KeyError):
        lyss_roles.envelope("nonexistent-role")


def test_fst_tool_versions_never_raises_and_stamps_lyss():
    versions = lyss_roles.fst_tool_versions("crk")
    assert versions.get("champollion_lyss"), "must always stamp the LYSS version"
