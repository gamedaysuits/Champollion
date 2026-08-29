"""
SSOT parity guard: the harness's runtime registries must not drift from the
shared method-registry manifest (shared/method-registry.json), which is also
consumed by the JS CLI. The CLI suite runs the equivalent guard, so a method
added to one runtime but not the manifest (or vice versa) fails CI on both
sides.

Skips cleanly in a standalone pip install where shared/ isn't present — the
manifest is a monorepo dev/CI guard, not a runtime dependency.
"""

from __future__ import annotations

import importlib
from pathlib import Path

import pytest

from mt_eval_harness.method_manifest import (
    load_method_manifest,
    manifest_entries,
    manifest_names,
)
from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY
from mt_eval_harness.providers.registry import PROVIDER_REGISTRY
from mt_eval_harness.config import VALID_METHOD_CLASSES, VALID_PARADIGMS

_METHODS_DIR = Path(__file__).resolve().parent.parent / "mt_eval_harness" / "methods"

# Documented exemptions for legitimate per-runtime differences in the per-method
# env/max_batch/locale_map parity below, keyed by "<method>.<dimension>" (env
# uses "<method>.env:<VAR>"). Keep this SHORT — each entry is a real divergence,
# not a TODO. Currently empty: the harness adapters reference every env var the
# manifest declares (it's the *CLI* side that drifted on
# MICROSOFT_TRANSLATOR_ENDPOINT — caught by the JS suite).
PARITY_EXEMPTIONS: set[str] = set()


def _require_manifest():
    manifest = load_method_manifest()
    if manifest is None:
        pytest.skip("shared/method-registry.json not found (standalone install)")
    return manifest


def _harness_mt_api_entries():
    """mt-api manifest entries that have a harness adapter (skip CLI-only ones).

    Returns a list of (name, entry) for every ``kind: mt-api`` manifest entry
    that does not declare a ``runtimes`` list excluding "harness".
    """
    out = []
    for name, entry in manifest_entries("mt-api").items():
        runtimes = entry.get("runtimes")
        if isinstance(runtimes, list) and "harness" not in runtimes:
            continue
        out.append((name, entry))
    return out


def _adapter_module_name(method: str) -> str:
    return f"mt_eval_harness.methods.{method.replace('-', '_')}"


def _adapter_source(method: str) -> str:
    return (_METHODS_DIR / f"{method.replace('-', '_')}.py").read_text(encoding="utf-8")


def test_manifest_loads_and_is_shaped():
    manifest = _require_manifest()
    assert manifest.get("version"), "manifest must declare a version"
    assert isinstance(manifest.get("entries"), dict) and manifest["entries"]


def test_every_manifest_entry_uses_canonical_taxonomy():
    _require_manifest()
    for name, entry in manifest_entries().items():
        assert entry.get("method_class") in VALID_METHOD_CLASSES, (
            f"{name}: method_class {entry.get('method_class')!r} not in "
            f"{sorted(VALID_METHOD_CLASSES)}"
        )
        assert entry.get("paradigm") in VALID_PARADIGMS, (
            f"{name}: paradigm {entry.get('paradigm')!r} not in "
            f"{sorted(VALID_PARADIGMS)}"
        )
        assert entry.get("kind") in {"mt-api", "llm-provider", "local-model", "plugin"}


def test_credential_env_is_a_nonempty_subset_of_env():
    """credential_env marks the CREDENTIAL subset of env (the vars readiness
    surfaces judge — config vars like AWS_REGION never count). A var only in
    credential_env would be one the adapter never reads; an empty list would
    silently mean 'no credentials required'; credential_env_all without
    credential_env has nothing to quantify over."""
    _require_manifest()
    for name, entry in manifest_entries().items():
        cred = entry.get("credential_env")
        if cred is None:
            assert not entry.get("credential_env_all"), (
                f"{name}: credential_env_all declared without credential_env"
            )
            continue
        assert cred, f"{name}: credential_env must be non-empty when declared"
        extra_vars = set(cred) - set(entry.get("env") or [])
        assert not extra_vars, (
            f"{name}: credential_env vars {sorted(extra_vars)} are not in env "
            f"— the adapter never reads them"
        )


def test_mt_api_methods_match_registry():
    """Every mt-api manifest entry is registered, and every registered MT
    method is documented in the manifest. No drift either direction."""
    _require_manifest()
    # Both mt-api engines and local-model engines resolve through
    # MT_METHOD_REGISTRY via get_mt_method (a --method <name>).
    manifest_mt = manifest_names("mt-api") | manifest_names("local-model")
    registry_mt = set(MT_METHOD_REGISTRY.keys())
    missing_from_registry = manifest_mt - registry_mt
    undocumented = registry_mt - manifest_mt
    assert not missing_from_registry, (
        f"mt-api in manifest but not registered: {sorted(missing_from_registry)}"
    )
    assert not undocumented, (
        f"registered MT methods missing from manifest SSOT: {sorted(undocumented)}"
    )


def test_llm_providers_match_registry():
    """Every llm-provider manifest entry is registered, and every registered
    provider is documented in the manifest."""
    _require_manifest()
    manifest_llm = manifest_names("llm-provider")
    registry_llm = set(PROVIDER_REGISTRY.keys())
    missing_from_registry = manifest_llm - registry_llm
    undocumented = registry_llm - manifest_llm
    assert not missing_from_registry, (
        f"llm-provider in manifest but not registered: {sorted(missing_from_registry)}"
    )
    assert not undocumented, (
        f"registered providers missing from manifest SSOT: {sorted(undocumented)}"
    )


# ---------------------------------------------------------------------------
# Per-method adapter parity: env vars, max_batch, locale_map
#
# The NAME/taxonomy guards above catch a method present in one runtime but not
# the manifest. They do NOT catch a per-method *setting* drifting from its
# adapter — e.g. the manifest declaring MICROSOFT_TRANSLATOR_ENDPOINT while an
# adapter never reads it (which is exactly what happened on the CLI side). These
# assertions close that gap for every mt-api method with a harness adapter.
# ---------------------------------------------------------------------------

def test_manifest_env_vars_referenced_by_harness_adapter():
    """Every env var the manifest declares for an mt-api method must appear in
    that method's harness adapter source (read via _env_first / options, or
    documented in the module docstring/error message)."""
    _require_manifest()
    for name, entry in _harness_mt_api_entries():
        src = _adapter_source(name)
        for env_var in entry.get("env", []):
            if f"{name}.env:{env_var}" in PARITY_EXEMPTIONS:
                continue
            assert env_var in src, (
                f"manifest declares env {env_var!r} for {name!r} but "
                f"arena/mt_eval_harness/methods/{name.replace('-', '_')}.py "
                f"never references it"
            )


def test_manifest_max_batch_matches_harness_adapter():
    """The manifest max_batch must equal the adapter's MAX_BATCH class attr."""
    _require_manifest()
    for name, entry in _harness_mt_api_entries():
        if entry.get("max_batch") is None:
            continue
        if f"{name}.max_batch" in PARITY_EXEMPTIONS:
            continue
        cls = MT_METHOD_REGISTRY.get(name)
        assert cls is not None, f"{name}: mt-api entry not in MT_METHOD_REGISTRY"
        assert cls.MAX_BATCH == entry["max_batch"], (
            f"{name}: adapter MAX_BATCH={cls.MAX_BATCH} != manifest "
            f"max_batch={entry['max_batch']}"
        )


def test_manifest_locale_map_matches_harness_adapter():
    """Where an adapter exposes a module-level ``*_LOCALE_MAP`` dict, it must
    equal the manifest's locale_map; otherwise the manifest entry must be empty
    (the adapter's ``_map_locale`` passes codes through / upper-cases them)."""
    _require_manifest()
    for name, entry in _harness_mt_api_entries():
        if f"{name}.locale_map" in PARITY_EXEMPTIONS:
            continue
        manifest_map = entry.get("locale_map") or {}
        module = importlib.import_module(_adapter_module_name(name))
        exposed = [
            v
            for k, v in vars(module).items()
            if k.endswith("_LOCALE_MAP") and isinstance(v, dict)
        ]
        if not exposed:
            # No exposed map → manifest must declare an empty one, or it's
            # asserting a remap the adapter doesn't actually perform.
            assert not manifest_map, (
                f"{name}: manifest declares locale_map {manifest_map} but the "
                f"adapter exposes no *_LOCALE_MAP dict to verify it against"
            )
            continue
        assert len(exposed) == 1, (
            f"{name}: expected exactly one *_LOCALE_MAP dict, found {len(exposed)}"
        )
        assert exposed[0] == manifest_map, (
            f"{name}: adapter locale map {exposed[0]} != manifest "
            f"locale_map {manifest_map}"
        )
