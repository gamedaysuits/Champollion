"""shared/catalogue/method-coverage.json — shape + scope regression nets.

The coverage catalogue is the SSOT three consumers read: the hero map's
hubs/masks (cli/website generateGraphJson), the queue generator's engine
lane (load_engine_lane), and the llm-lane "fully service-covered" pair
filter derived from that lane. Founder question 2026-07-19 ("are we
abiding by SSOT in adding these services — prevent regression?"): these
tests are the net.

Pinned invariants:

  * CITE-ONLY SHAPE — every entry names its source (source_url + asOf),
    speaks ISO 639-3, and its ``count`` equals its enumerated list length
    when a list is present (a provider's own bigger headline lives in
    ``publishedHeadline``, never in ``count``); an entry with an EMPTY
    list must say why in its ``note`` — either the pending-import pattern
    ('translated'/Lara, OPUS-MT) or an explicit statement that no
    per-language enumeration is published (omt1600).
  * ENGINE-LANE SCOPE — load_engine_lane() only ever admits
    ``kind == 'mt-api'`` registry entries. Open models (m2m100, madlad,
    nllb, opus) must NEVER enter it: the llm lane drops pairs fully
    covered by that union, so admitting an open model would silently
    shrink the public queue (adding MADLAD-400's 415 languages would
    have gutted it).

These tests read the monorepo shared/ files (no network) and skip
cleanly on a standalone arena checkout without them.
"""

from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

import pytest

ARENA_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ARENA_ROOT.parent
CATALOGUE = REPO_ROOT / "shared" / "catalogue" / "method-coverage.json"
REGISTRY = REPO_ROOT / "shared" / "method-registry.json"
SOURCES_DIR = REPO_ROOT / "shared" / "catalogue" / "sources"
SCRIPT = ARENA_ROOT / "scripts" / "generate_sweep_queue.py"

pytestmark = pytest.mark.skipif(
    not (CATALOGUE.is_file() and REGISTRY.is_file()),
    reason="monorepo shared/ not present (standalone arena checkout)",
)

ISO3 = re.compile(r"^[a-z]{3}$")
# Some legacy entries declare codeSystem 'BCP-47' (google) — their codes are
# language subtags with optional script/region, alias-normalized to ISO 639-3
# at import time by every consumer.
BCP47ISH = re.compile(r"^[a-zA-Z]{2,3}(-[A-Za-z0-9]{2,8})*$")


@pytest.fixture(scope="module")
def catalogue() -> dict:
    return json.loads(CATALOGUE.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def registry() -> dict:
    return json.loads(REGISTRY.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def queue_mod():
    spec = importlib.util.spec_from_file_location(
        "generate_sweep_queue", SCRIPT,
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestCatalogueShape:
    def test_keys_unique(self, catalogue):
        keys = [m.get("key") for m in catalogue["methods"]]
        assert len(keys) == len(set(keys)), "duplicate provider keys"

    def test_entries_are_cite_only_shaped(self, catalogue):
        for m in catalogue["methods"]:
            key = m.get("key")
            for field in ("key", "label", "count", "tier", "codeSystem",
                          "source_url", "asOf", "iso6393"):
                assert field in m, (key, f"missing {field}")
            assert m["tier"] in ("service", "open"), (key, m["tier"])
            # codeSystem is free-text naming the provider's tag system
            # (legacy entries describe mixes). The list-shape contract:
            # STRICT bare ISO 639-3 when that exact system is declared;
            # otherwise sane BCP-47-style subtags, which every consumer
            # alias-normalizes to ISO 639-3 at import.
            system = m["codeSystem"]
            assert isinstance(system, str) and system.strip(), (
                key, "codeSystem must name the tag system")
            pattern = ISO3 if system == "ISO 639-3" else BCP47ISH
            assert isinstance(m["anyToAny"], bool), (key, "anyToAny")
            assert str(m["source_url"]).startswith("http"), (key, "source_url")
            codes = m["iso6393"]
            assert isinstance(codes, list), (key, "iso6393 must be a list")
            bad = [c for c in codes if not pattern.match(str(c))]
            assert not bad, (key, f"codes outside declared {system}: {bad[:5]}")
            assert len(codes) == len(set(codes)), (key, "duplicate codes")

    def test_counts_are_honest(self, catalogue):
        # count is a number the cited source states (a provider's own count
        # may exceed the alias-enumerable list — google: 194 stated / 187
        # enumerable BCP-47 subtags). For OUR derived entries the rule is
        # strict: count IS the enumeration, and any bigger card headline
        # lives in publishedHeadline. An empty list must explain itself.
        for m in catalogue["methods"]:
            key, codes = m.get("key"), m["iso6393"]
            assert isinstance(m["count"], int) and m["count"] >= 0, (
                key, "count must be a non-negative integer")
            if m.get("verified") == "derived" and codes:
                assert m["count"] == len(codes), (
                    key,
                    f"derived count {m['count']} != enumerated {len(codes)} "
                    f"— the card headline belongs in publishedHeadline",
                )
            if not codes:
                note = str(m.get("note", "")).lower()
                # Two legitimate reasons a list is empty, and the note must
                # name one of them explicitly:
                #   * PENDING IMPORT — a per-language list exists upstream, we
                #     just haven't ingested it yet (translated/Lara, OPUS-MT).
                #   * NO PUBLISHED LIST — the publisher states a count but
                #     never enumerates the languages, so there is nothing to
                #     import (omt1600: the paper's Table D.1 is scoped to its
                #     artifact contributions, not to the 1,600).
                pending = "pending" in note
                unpublished = (
                    "no per-language enumeration" in note
                    or "no published list" in note
                )
                assert pending or unpublished, (
                    key,
                    "empty iso6393 must say why in its note — either a "
                    "pending import, or that no per-language enumeration "
                    "is published",
                )

    def test_small_open_models_are_derived_with_pinned_snapshots(
        self, catalogue,
    ):
        by_key = {m["key"]: m for m in catalogue["methods"]}
        for key in ("m2m100", "madlad"):
            entry = by_key.get(key)
            assert entry is not None, f"{key} missing from the catalogue"
            assert entry["tier"] == "open"
            assert entry.get("verified") == "derived"
            assert entry["count"] == len(entry["iso6393"])
            note = str(entry.get("note", ""))
            assert "Champollion-derived" in note, (
                key, "derived enumeration must say so in its note")
        snapshots = list(SOURCES_DIR.glob("*.json"))
        names = " ".join(p.name for p in snapshots)
        assert "m2m100" in names and "madlad" in names, (
            "pinned model-card snapshots missing from "
            "shared/catalogue/sources/"
        )


class TestEngineLaneScope:
    """The llm-lane exclusion union may contain mt-api ENGINES only."""

    def test_lane_admits_only_mt_api_registry_entries(
        self, queue_mod, registry,
    ):
        lane, _notes = queue_mod.load_engine_lane()
        entries = registry.get("entries", {})
        for name in lane:
            assert entries.get(name, {}).get("kind") == "mt-api", (
                name,
                "engine lane admitted a non-mt-api entry — this would put "
                "an open model's coverage into the llm-lane exclusion "
                "union and silently shrink the public queue",
            )

    def test_open_models_never_reach_the_exclusion_union(self, queue_mod):
        lane, _notes = queue_mod.load_engine_lane()
        assert not {"m2m100", "madlad", "nllb", "opus"} & set(lane), (
            "open models must never enter the engine lane / llm-lane "
            "exclusion union"
        )

    def test_coverage_keys_that_name_an_adapter_are_mt_api(
        self, queue_mod, registry, catalogue,
    ):
        """A coverage key matching a registry id must be an mt-api adapter.

        This replaces a check on ENGINE_COVERAGE_KEYS, the six-row table that
        used to translate registry ids into short coverage keys. The two
        vocabularies are now one, so the invariant is stated directly: if a
        coverage entry shares a name with a registry entry, that entry has to
        be a translation API rather than an LLM provider or a local runner.

        Open models (nllb, opus, madlad, m2m100) have no registry entry at all
        and are unaffected — they are cited claims, not runnable adapters.
        """
        entries = registry.get("entries", {})
        for method in catalogue.get("methods", []):
            key = method.get("key")
            if key not in entries:
                continue
            assert entries[key].get("kind") == "mt-api", (
                key,
                "a coverage entry names a registry entry that is not an mt-api "
                "adapter",
            )
