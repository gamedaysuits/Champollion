"""Macrolanguage-correctness doctrine (LANGUAGE_TAXONOMY.md Position 4 v2).

Queue items target only ACTIVE INDIVIDUAL ISO 639-3 codes. Upstream labels
are metadata to RESOLVE — mechanically (script strip, clean retirements),
via cited variety pins, or not at all (visible exclusion) — never truths to
obey (the keen-rubin Ref_Name fallback served "Arabic" as a benchmark
target) or to discard (the pre-v2 silent skip dropped ~100 corpora).

Covers: the iso_resolution resolver over the pinned official tables; the
build_registry stamps + pin validation; the queue doctrine gate; the mesh's
honest umbrella-node naming; and the on-disk corpora-card pins.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

ARENA_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ARENA_ROOT / "scripts"
REGISTRY = ARENA_ROOT / "datasets" / "registry.json"
CORPORA_CARDS = ARENA_ROOT.parent / "cli" / "shared" / "corpora-cards"
LANGUAGE_CARDS = ARENA_ROOT.parent / "cli" / "shared" / "language-cards"

sys.path.insert(0, str(SCRIPTS))
import iso_resolution as ir  # noqa: E402


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def queue_mod():
    return _load("gsq_doctrine", SCRIPTS / "generate_sweep_queue.py")


@pytest.fixture(scope="module")
def registry_mod():
    return _load("build_registry_doctrine", SCRIPTS / "build_registry.py")


@pytest.fixture(scope="module")
def registry():
    return json.loads(REGISTRY.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Resolver units (pinned official tables only — no language facts in code)
# ---------------------------------------------------------------------------

class TestResolver:
    def test_parse_code(self):
        assert ir.parse_code("cmn-Hans") == ("cmn", "Hans")
        assert ir.parse_code("eng") == ("eng", None)
        assert ir.parse_code("hoc-Wara") == ("hoc", "Wara")
        # Non-matching tokens pass through whole (classified unknown).
        assert ir.parse_code("zh_CN") == ("zh_CN", None)

    def test_classify_positive_evidence_only(self):
        assert ir.classify("eng") == "individual"
        assert ir.classify("ara") == "macrolanguage"
        assert ir.classify("ber") == "collective"      # ISO 639-5
        assert ir.classify("kzj") == "retired"
        assert ir.classify("mul") == "special"
        assert ir.classify("zz9") == "unknown"
        assert ir.classify("") == "unknown"

    def test_retirement_successor_clean_merge(self):
        assert ir.retirement_successor("kzj") == "dtp"

    def test_retirement_split_never_auto_resolves(self):
        # Data-driven: every S-reason (split) retirement must return None —
        # choosing a side of a split is a variety judgment, not mechanics.
        rows = ir._retirements()
        splits = [c for c, r in rows.items() if r["reason"] == "S"]
        assert splits, "retirements table has no splits — table truncated?"
        for code in splits[:20]:
            assert ir.retirement_successor(code) is None

    def test_resolve_side_shapes(self):
        assert ir.resolve_side("eng") == {
            "resolved": "eng", "scope": "individual",
            "script": None, "via": None,
        }
        assert ir.resolve_side("cmn-Hans") == {
            "resolved": "cmn", "scope": "individual",
            "script": "Hans", "via": "script-strip",
        }
        assert ir.resolve_side("kzj")["via"] == "retirement:kzj>dtp"
        assert ir.resolve_side("ara")["resolved"] is None
        pinned = ir.resolve_side("ara", "arb")
        assert pinned["resolved"] == "arb" and pinned["via"] == "variety-pin"
        # A pin never applies to non-macro scopes.
        assert ir.resolve_side("ber", "kab")["resolved"] is None

    def test_is_active_member(self):
        assert ir.is_active_member("que", "quy")
        assert ir.is_active_member("fas", "pes")
        assert not ir.is_active_member("que", "arb")
        assert not ir.is_active_member("ber", "kab")   # collective: no M rows


# ---------------------------------------------------------------------------
# Registry stamps (the REAL built registry)
# ---------------------------------------------------------------------------

class TestRegistryStamps:
    def test_every_entry_stamped(self, registry):
        missing = [ds["id"] for ds in registry["datasets"]
                   if "language_resolution" not in ds]
        assert missing == []

    def test_eligible_sides_resolve_to_active_individuals(self, registry):
        bad = []
        for ds in registry["datasets"]:
            lr = ds["language_resolution"]
            if not lr["benchmark_eligible"]:
                continue
            for side in ("source", "target"):
                code = lr[side]["resolved"]
                if ir.classify(code) != "individual":
                    bad.append((ds["id"], side, code))
        assert bad == []

    def test_pin_resolutions_are_valid_members(self, registry):
        for ds in registry["datasets"]:
            lr = ds["language_resolution"]
            for side in ("source", "target"):
                stamp = lr[side]
                if stamp.get("via") == "variety-pin":
                    base, _ = ir.parse_code(ds["language_pair"][side])
                    assert ir.is_active_member(base, stamp["resolved"]), (
                        ds["id"], side)
                    assert stamp["pin"]["basis"] and \
                        stamp["pin"]["recordedAt"], (ds["id"], side)

    def test_script_suffixed_entry_resolves_to_base(self, registry):
        hans = [ds for ds in registry["datasets"]
                if (ds["language_pair"].get("target") or "") == "cmn-Hans"]
        assert hans, "expected eng>cmn-Hans WMT corpora in the registry"
        for ds in hans:
            t = ds["language_resolution"]["target"]
            assert (t["resolved"], t["script"], t["via"]) == \
                ("cmn", "Hans", "script-strip")

    def test_unresolved_entries_carry_reasons(self, registry):
        for ds in registry["datasets"]:
            lr = ds["language_resolution"]
            if not lr["benchmark_eligible"]:
                assert lr["exclusion_reasons"], ds["id"]


# ---------------------------------------------------------------------------
# build_registry pin validation (hard-fail on refutable pins)
# ---------------------------------------------------------------------------

class TestPinValidation:
    def _card(self, pins):
        return {"id": "test-card", "varietyResolution": pins}

    def _pin(self, resolved, **over):
        base = {"resolvedCode": resolved, "basis": "b",
                "recordedBy": "r", "recordedAt": "2026-07-19"}
        base.update(over)
        return base

    def test_valid_pin_passes(self, registry_mod):
        pins = registry_mod.validate_variety_resolution(
            self._card({"que": self._pin("quy")}))
        assert pins["que"]["resolvedCode"] == "quy"

    def test_non_member_pin_fails(self, registry_mod):
        with pytest.raises(SystemExit):
            registry_mod.validate_variety_resolution(
                self._card({"que": self._pin("arb")}))

    def test_non_macro_key_fails(self, registry_mod):
        with pytest.raises(SystemExit):
            registry_mod.validate_variety_resolution(
                self._card({"ber": self._pin("kab")}))

    def test_missing_basis_fails(self, registry_mod):
        with pytest.raises(SystemExit):
            registry_mod.validate_variety_resolution(
                self._card({"que": self._pin("quy", basis="")}))

    def test_all_on_disk_card_pins_validate(self, registry_mod):
        n = 0
        for path in sorted(CORPORA_CARDS.glob("*.json")):
            card = json.loads(path.read_text(encoding="utf-8"))
            if card.get("varietyResolution"):
                registry_mod.validate_variety_resolution(card)
                n += 1
        assert n >= 90, f"expected the 2026-07-19 pin pass on disk, saw {n}"


# ---------------------------------------------------------------------------
# Queue doctrine gate
# ---------------------------------------------------------------------------

def _stamped_ds(src="aaa", tgt="bbb", eligible=True, reasons=(), **over):
    ds = {
        "id": f"tatoeba-{src}-{tgt}-dev",
        "access": "local",
        "segment": "development",
        "license": "CC-BY-2.0",
        "path": f"curated/{src}-{tgt}-dev-v1.json",
        "size": 100,
        "language_pair": {"source": src, "target": tgt},
        "language_resolution": {
            "source": {"resolved": src if eligible else None,
                       "scope": "individual" if eligible else "macrolanguage",
                       "script": None, "via": None},
            "target": {"resolved": tgt if eligible else None,
                       "scope": "individual", "script": None, "via": None},
            "benchmark_eligible": eligible,
            "exclusion_reasons": list(reasons),
        },
    }
    ds.update(over)
    return ds


class TestDoctrineGate:
    def test_eligible_passes_excluded_collected(self, queue_mod):
        reg = {"datasets": [
            _stamped_ds(),
            _stamped_ds("ara", "eng", eligible=False,
                        reasons=["source-macrolanguage:ara"]),
        ]}
        eligible, excluded = queue_mod.queue_corpora_split(reg)
        assert [d["id"] for d in eligible] == ["tatoeba-aaa-bbb-dev"]
        assert excluded == [
            ("tatoeba-ara-eng-dev", ["source-macrolanguage:ara"])]

    def test_missing_stamp_fails_loud(self, queue_mod):
        ds = _stamped_ds()
        del ds["language_resolution"]
        with pytest.raises(SystemExit):
            queue_mod.queue_corpora_split({"datasets": [ds]})

    def test_resolved_pair_prefers_stamp(self, queue_mod):
        ds = _stamped_ds("eng", "cmn-Hans")
        ds["language_resolution"]["target"] = {
            "resolved": "cmn", "scope": "individual",
            "script": "Hans", "via": "script-strip"}
        assert queue_mod.resolved_pair(ds) == ("eng", "cmn")

    def test_resolved_pair_keeps_raw_for_unresolved(self, queue_mod):
        ds = _stamped_ds("ara", "eng", eligible=False,
                         reasons=["source-macrolanguage:ara"])
        assert queue_mod.resolved_pair(ds) == ("ara", "eng")

    def test_real_registry_yields_no_umbrella_queue_targets(
        self, queue_mod, registry,
    ):
        eligible, excluded = queue_mod.queue_corpora_split(registry)
        assert eligible, "queue would be empty — registry regression"
        for ds in eligible:
            src, tgt = queue_mod.resolved_pair(ds)
            assert ir.classify(src) == "individual", (ds["id"], src)
            assert ir.classify(tgt) == "individual", (ds["id"], tgt)
        # The known umbrella tail is excluded WITH reasons, not dropped.
        excluded_ids = {cid for cid, _ in excluded}
        assert any("tatoeba" in cid and "-ara-" in f"-{cid}-"
                   or cid.startswith("eval-ara-") for cid in excluded_ids) \
            or any("ara" in r for _c, rs in excluded for r in rs)


# ---------------------------------------------------------------------------
# Mesh: umbrella nodes are honestly named + scope-marked, never merged
# ---------------------------------------------------------------------------

class TestMeshUmbrellaNodes:
    def test_umbrella_node_named_and_marked(self, queue_mod):
        hub = LANGUAGE_CARDS / "genera" / "macrolanguage-ara.json"
        if not hub.is_file():
            pytest.skip("genera hub card for ara not present")
        reg = {"datasets": [
            _stamped_ds("ara", "eng", eligible=False,
                        reasons=["source-macrolanguage:ara"]),
        ]}
        evidence = queue_mod.build_evidence(reg["datasets"], [])
        mesh = queue_mod.build_mesh_snapshot(
            [], evidence, [], reg, phi_current=0.0)
        nodes = {n["id"]: n for n in mesh["nodes"]}
        assert "ara" in nodes and "arb" not in nodes
        assert nodes["ara"]["scope"] == "macrolanguage"
        assert nodes["ara"]["name"] != "ara"  # real hub name, never bare code

    def test_script_suffix_corpus_lights_base_edge(self, queue_mod):
        ds = _stamped_ds("eng", "cmn-Hans")
        ds["language_resolution"]["target"] = {
            "resolved": "cmn", "scope": "individual",
            "script": "Hans", "via": "script-strip"}
        reg = {"datasets": [ds]}
        evidence = queue_mod.build_evidence(reg["datasets"], [])
        mesh = queue_mod.build_mesh_snapshot(
            [], evidence, [], reg, phi_current=0.0)
        ids = {n["id"] for n in mesh["nodes"]}
        assert ids == {"cmn", "eng"}
        (edge,) = mesh["edges"]
        assert {edge["a"], edge["b"]} == {"cmn", "eng"}
