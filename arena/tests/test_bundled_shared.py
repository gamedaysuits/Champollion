"""Shared SSOT files the wheel bundles stay byte-identical to shared/.

An installed harness has no monorepo shared/ directory, so it ships copies of
what it reads at runtime (as it already does for metric-registry.json, see
test_rankable_metrics.py). A copy that drifts would make a pip install answer
differently from a checkout. Refresh with:

    cp shared/method-registry.json arena/mt_eval_harness/data/
    cp shared/catalogue/{external-results,external-mt-index,metric-reliability,method-coverage}.json \\
       arena/mt_eval_harness/data/catalogue/
"""

from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "arena" / "mt_eval_harness" / "data"
PAIRS = [
    ("shared/method-registry.json", "method-registry.json"),
    ("shared/catalogue/external-results.json", "catalogue/external-results.json"),
    ("shared/catalogue/external-mt-index.json", "catalogue/external-mt-index.json"),
    ("shared/catalogue/metric-reliability.json", "catalogue/metric-reliability.json"),
    ("shared/catalogue/method-coverage.json", "catalogue/method-coverage.json"),
]


@pytest.mark.parametrize("shared_rel,bundled_rel", PAIRS)
def test_bundled_copy_is_byte_identical(shared_rel, bundled_rel):
    shared = ROOT / shared_rel
    if not shared.exists():
        pytest.skip("standalone install: no shared/ to compare against")
    assert (DATA / bundled_rel).read_bytes() == shared.read_bytes(), (
        f"mt_eval_harness/data/{bundled_rel} has drifted from {shared_rel} — "
        "copy it again (see this module's docstring)")


def test_recommend_reads_the_bundle_when_shared_is_absent(monkeypatch):
    from mt_eval_harness import method_manifest, recommend
    monkeypatch.setattr(method_manifest, "_PACKAGE_DIR", Path("/nonexistent/pkg"))
    monkeypatch.setattr(recommend, "_PACKAGE_DIR", DATA.parent)
    # method registry: the walk finds nothing, the bundle answers
    assert method_manifest.manifest_path() == method_manifest.BUNDLED_MANIFEST
    for name in ("external-results.json", "metric-reliability.json"):
        p = recommend.catalogue_path(name)
        assert p is not None and p.exists()


def test_keyless_methods_are_ready_and_hosted_apis_are_not():
    import json
    from mt_eval_harness.recommend import resolve_availability
    entries = json.loads((DATA / "method-registry.json").read_text())["entries"]
    for name in ("local", "apertium"):
        r = resolve_availability(entries[name], env={})
        assert r["status"] == "ready" and "no key needed" in r["detail"], (name, r)
    hosted = [n for n, e in entries.items() if e.get("default_base_url") and not e.get("keyless")]
    assert len(hosted) >= 4
    for name in hosted:
        assert resolve_availability(entries[name], env={})["status"] == "needs-key", name
