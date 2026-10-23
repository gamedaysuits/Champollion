"""Tests for --rank-mode map (map-value v2 survey ordering) in
scripts/generate_sweep_queue.py.

Founder review: docs/QUEUE_ALGORITHM_REVIEW_2026-07-18.md (v1); v2
bridge-into-network + corpus-quality + domain-diversity terms per founder
direction 2026-07-19 (normative: queue-construction spec §2.2). The mode
re-ranks the same items by MapValue = novelty · uncertainty · promise ·
connectivity · corpus-quality · contamination ÷ cost, assembled by an exact
lazy greedy (novelty is monotone non-increasing in the placement counters
and every other factor is order-independent, so stale heap keys only ever
overestimate).

All ranking tests run on synthetic item dicts — no network, no full
generation. Family-dependent tests read the REAL language cards on disk
(pam/ceb share a family; sna does not), which is the point: family facts are
data, never a hardcoded set. The desert-ledger test walks the real cards dir.
"""

from __future__ import annotations

import importlib.util
import itertools
import random
from pathlib import Path

import pytest

ARENA_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ARENA_ROOT / "scripts" / "generate_sweep_queue.py"
CARDS_DIR = ARENA_ROOT.parent / "cli" / "shared" / "language-cards"


@pytest.fixture(scope="module")
def mod():
    spec = importlib.util.spec_from_file_location(
        "generate_sweep_queue_map_mode", SCRIPT,
    )
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


_SEQ = itertools.count()


def _item(
    *,
    pair="eng>pam",
    model="anthropic/claude-haiku-4.5",
    cond="naive",
    cost=0.10,
    contamination="LOW",
    prior_basis="default",
    predicted=0.5,
    edge_runs=0,
    domain=None,
    connectivity=None,       # (class, factor) — omitted = neutral 1.0
    corpus_quality=None,     # f_size · f_rich — omitted = neutral 1.0
    item_id=None,
):
    i = next(_SEQ)
    it = {
        "id": item_id or f"map-{i:04d}",
        "language_pair": pair,
        "corpus_id": f"corpus-{i:04d}",
        "model": model,
        "condition": cond,
        "est_cost_usd": cost,
        "cost_for_value": max(cost, 0.01) if cost is not None else None,
        "contamination": contamination,
        "contamination_factor": {"LOW": 1.0, "MEDIUM": 0.4,
                                 "HIGH": 0.1}[contamination],
        "prior_basis": prior_basis,
        "predicted_strength": predicted,
        "edge_runs": edge_runs,
        "ecv_per_usd": 0.0,
    }
    if domain is not None:
        it["domain"] = domain
    if connectivity is not None:
        it["map_connectivity_class"], it["map_connectivity"] = connectivity
    if corpus_quality is not None:
        it["map_corpus_quality"] = corpus_quality
    return it


# ---------------------------------------------------------------------------
# Exactness: lazy greedy ≡ brute-force greedy
# ---------------------------------------------------------------------------

def _brute_force_order(mod, items):
    """Recompute-everything greedy — the definitionally correct trace."""
    pair_c, tgt_c, fam_c, cell_c, dom_c = {}, {}, {}, {}, {}

    def novelty(it):
        tgt = it["language_pair"].split(">")[1]
        fam = mod.language_family(tgt)
        return (
            1.0 / (1.0 + pair_c.get(it["language_pair"], 0))
            * (1.0 + tgt_c.get(tgt, 0)) ** -0.5
            * (1.0 + fam_c.get(fam, 0)) ** -0.5
            * (1.0 + cell_c.get((it["model"], fam), 0)) ** -0.5
            * (1.0 + dom_c.get((tgt, it.get("domain") or "unknown"), 0))
            ** -0.5
        )

    remaining = list(enumerate(items))
    out = []
    while remaining:
        best = min(
            remaining,
            key=lambda pair_: (
                -(mod._map_static_part(pair_[1]) * novelty(pair_[1])),
                mod._map_tiebreak(pair_[1]),
                pair_[0],
            ),
        )
        remaining.remove(best)
        it = best[1]
        tgt = it["language_pair"].split(">")[1]
        fam = mod.language_family(tgt)
        pair_c[it["language_pair"]] = pair_c.get(it["language_pair"], 0) + 1
        tgt_c[tgt] = tgt_c.get(tgt, 0) + 1
        fam_c[fam] = fam_c.get(fam, 0) + 1
        cell_c[(it["model"], fam)] = cell_c.get((it["model"], fam), 0) + 1
        dom_key = (tgt, it.get("domain") or "unknown")
        dom_c[dom_key] = dom_c.get(dom_key, 0) + 1
        out.append(it["id"])
    return out


def test_lazy_greedy_matches_brute_force(mod):
    rng = random.Random(42)
    pairs = ["eng>pam", "eng>sna", "fra>cat", "eng>cym", "jpn>zz9", "zz8>zz9"]
    models = ["anthropic/claude-haiku-4.5", "openai/gpt-5.5", "deepl"]
    conn = [None, ("bridge", 1.0), ("interior", 0.5), ("island", 0.5)]
    items = [
        _item(
            pair=rng.choice(pairs),
            model=rng.choice(models),
            cond=rng.choice(["naive", "coached"]),
            cost=round(rng.uniform(0.01, 2.0), 3),
            contamination=rng.choice(["LOW", "LOW", "MEDIUM", "HIGH"]),
            prior_basis=rng.choice(
                ["pair", "target-language", "source-language", "global",
                 "default"]),
            predicted=round(rng.uniform(0.05, 0.9), 3),
            edge_runs=rng.choice([0, 0, 1, 3]),
            domain=rng.choice([None, "conv", "news", "religious"]),
            connectivity=rng.choice(conn),
            corpus_quality=rng.choice([None, 0.05, 0.31, 0.62, 1.0]),
        )
        for _ in range(90)
    ]
    lazy = [it["id"] for it in mod.map_value_order([dict(x) for x in items])]
    brute = _brute_force_order(mod, items)
    assert lazy == brute


# ---------------------------------------------------------------------------
# First-light properties
# ---------------------------------------------------------------------------

def test_distinct_pairs_before_repeats(mod):
    """Equal cost/promise/basis: all three pairs get first light before any
    pair is measured twice."""
    items = []
    for pair in ("eng>zz1", "eng>zz2", "eng>zz3"):
        for _ in range(3):
            items.append(_item(pair=pair))
    ranked = mod.map_value_order(items)
    first_three = {it["language_pair"] for it in ranked[:3]}
    assert first_three == {"eng>zz1", "eng>zz2", "eng>zz3"}


def test_family_breadth_from_cards(mod):
    """A new FAMILY outranks a second language of an already-probed family
    at equal cost — family facts read from the real cards (SSOT)."""
    fam_pam = mod.language_family("pam")
    fam_ceb = mod.language_family("ceb")
    fam_sna = mod.language_family("sna")
    if not (fam_pam == fam_ceb != fam_sna) or fam_pam.startswith("lang:"):
        pytest.skip("card family preconditions not met "
                    f"(pam={fam_pam}, ceb={fam_ceb}, sna={fam_sna})")
    items = [
        _item(pair="eng>pam"),
        _item(pair="eng>ceb"),   # same family as pam
        _item(pair="eng>sna"),   # different family
    ]
    ranked = mod.map_value_order(items)
    order = [it["language_pair"].split(">")[1] for it in ranked]
    # pam wins slot 1 on tie-break (lowest id); sna's fresh family must beat
    # ceb's second-of-family discount for slot 2.
    assert order.index("sna") < order.index("ceb")


def test_novelty_decay_values(mod):
    """The stamped map_novelty follows the documented decay exactly."""
    items = [_item(pair="eng>zz5"), _item(pair="eng>zz5")]
    ranked = mod.map_value_order(items)
    assert ranked[0]["map_novelty"] == pytest.approx(1.0)
    # Second item on the same pair/target/family/cell/(target×domain):
    # 1/(1+1) · (1+1)^-0.5 ·(1+1)^-0.5 · (1+1)^-0.5 · (1+1)^-0.5 = 0.5 · 2^-2
    assert ranked[1]["map_novelty"] == pytest.approx(0.5 * 2 ** -2,
                                                     rel=1e-4)


def test_domain_diversity_within_target(mod):
    """v2: a target's early coverage spreads across domains — after one
    'conv' corpus on a target, a 'news' corpus on the same target outranks
    a second 'conv' one at equal cost/promise."""
    items = [
        _item(pair="eng>zz6", domain="conv", item_id="a-conv-1"),
        _item(pair="fra>zz6", domain="conv", item_id="b-conv-2"),
        _item(pair="deu>zz6", domain="news", item_id="c-news"),
    ]
    ranked = [it["id"] for it in mod.map_value_order(items)]
    # Slot 1 goes to a-conv-1 on the id tie-break; the fresh domain must
    # then beat the repeated one for slot 2.
    assert ranked.index("c-news") < ranked.index("b-conv-2")


# ---------------------------------------------------------------------------
# v2 bridge-into-network connectivity (founder direction 2026-07-19)
# ---------------------------------------------------------------------------

def test_map_connectivity_classifies_bridge_interior_island(mod):
    """Classifier semantics on synthetic sets: exactly one established
    endpoint = bridge (full credit); both = interior; neither = island."""
    measured = frozenset({"pam"})
    covered = frozenset({"eng", "fra"})
    cls, fac = mod.map_connectivity("eng", "zz1", measured, covered)
    assert cls == "bridge" and fac == 1.0
    cls, fac = mod.map_connectivity("zz1", "pam", measured, covered)
    assert cls == "bridge" and fac == 1.0          # measured side counts too
    cls, fac = mod.map_connectivity("eng", "pam", measured, covered)
    assert cls == "interior" and fac == mod.MAP_CONNECTIVITY_FACTORS[
        "interior"]
    cls, fac = mod.map_connectivity("zz1", "zz2", measured, covered)
    assert cls == "island" and fac == mod.MAP_CONNECTIVITY_FACTORS["island"]


def test_map_connectivity_macrolanguage_aliasing(mod):
    """A side whose MACROLANGUAGE is covered counts as established (the
    coverage lists say zho; the corpora say cmn) — macro facts read from
    the real language cards, never a hardcoded alias table."""
    macro = mod.language_macrolanguage("cmn")
    if macro != "zho":
        pytest.skip(f"cmn card macrolanguage precondition not met ({macro})")
    cls, fac = mod.map_connectivity(
        "cmn", "zz1", frozenset(), frozenset({"zho"}),
    )
    assert cls == "bridge" and fac == 1.0


def test_bridge_outranks_island_and_interior(mod):
    """The founder property: a pair LINKING the network to a new language
    outranks both a disconnected island probe and interior densification —
    even though the island's deeper prediction back-off (global basis)
    carries more raw uncertainty credit."""
    items = [
        # Bridge from a measured source into a fresh target: back-off lands
        # on source-language (0.75) — shallower than the island's global.
        _item(pair="eng>zz1", prior_basis="source-language",
              connectivity=("bridge", 1.0), item_id="bridge"),
        _item(pair="zz2>zz3", prior_basis="global",
              connectivity=("island", 0.5), item_id="island"),
        _item(pair="eng>zz4", prior_basis="target-language",
              connectivity=("interior", 0.5), item_id="interior"),
    ]
    ranked = [it["id"] for it in mod.map_value_order(items)]
    assert ranked == ["bridge", "island", "interior"]


def test_connectivity_islands_count_fully(mod):
    """Ninth principle (founder ruling 2026-08-27, reversing the
    2026-07-19 sizing): a disconnected desert's first light counts as
    much as a bridge — islands are never structurally demoted — while
    interior densification stays discounted (that is ecv mode's job).
    Pinned on the shipped constants."""
    assert mod.MAP_CONNECTIVITY_FACTORS["island"] == \
        mod.MAP_CONNECTIVITY_FACTORS["bridge"] == 1.0
    assert mod.MAP_CONNECTIVITY_FACTORS["interior"] < 1.0
    # And the first-reading boost exists and is > 1: a never-measured
    # language's first reading outranks refinement by construction.
    assert mod.MAP_FIRST_READING_BOOST > 1.0


# ---------------------------------------------------------------------------
# v2 corpus quality (size floor × richness)
# ---------------------------------------------------------------------------

def test_corpus_quality_ends_tiny_cheap_dominance(mod):
    """The v1 pathology: a 62-entry single-word vocabulary list at $0.05
    out-per-dollared a 150-sentence corpus at $0.15 three to one. With the
    v2 quality factor (f_size · f_rich) the substantial corpus leads."""
    vocab = _item(pair="eng>zz1", cost=0.05,
                  corpus_quality=round((62 / 100) * (1.2 / 5), 4),
                  item_id="tiny-vocab")
    real = _item(pair="eng>zz2", cost=0.15, corpus_quality=1.0,
                 item_id="real-corpus")
    ranked = [it["id"] for it in mod.map_value_order([vocab, real])]
    assert ranked == ["real-corpus", "tiny-vocab"]


def test_quality_fallback_uses_entry_count_on_slim_items(mod):
    """Published-slim shape: no map_corpus_quality, but entry_count is a
    published field — f_size still applies (richness stays neutral)."""
    small = {
        "id": "slim-small", "language_pair": "eng>zz1",
        "model": "m", "condition": "naive",
        "est_cost_usd": 0.10, "entry_count": 50,
    }
    big = {
        "id": "slim-big", "language_pair": "eng>zz2",
        "model": "m", "condition": "naive",
        "est_cost_usd": 0.10, "entry_count": 200,
    }
    ranked = [it["id"] for it in mod.map_value_order([small, big])]
    assert ranked == ["slim-big", "slim-small"]


# ---------------------------------------------------------------------------
# Factor semantics
# ---------------------------------------------------------------------------

def test_uncertainty_basis_ordering(mod):
    """Deeper prediction back-off = more survey value, at equal cost."""
    items = [
        _item(pair="eng>zz1", prior_basis="pair", item_id="a-pair"),
        _item(pair="eng>zz2", prior_basis="target-language", item_id="b-tgt"),
        _item(pair="eng>zz3", prior_basis="default", item_id="c-unknown"),
    ]
    ranked = [it["id"] for it in mod.map_value_order(items)]
    assert ranked == ["c-unknown", "b-tgt", "a-pair"]


def test_replication_discount(mod):
    """An edge with published runs ranks behind an unmeasured edge."""
    items = [
        _item(pair="eng>zz1", edge_runs=1, item_id="measured"),
        _item(pair="eng>zz2", edge_runs=0, item_id="fresh"),
    ]
    ranked = [it["id"] for it in mod.map_value_order(items)]
    assert ranked == ["fresh", "measured"]


def test_promise_floor(mod):
    """Likely-working unknowns first; likely-failing probes stay alive at
    the documented floor, never at zero."""
    items = [
        _item(pair="eng>zz1", predicted=0.05, item_id="desert-probe"),
        _item(pair="eng>zz2", predicted=0.60, item_id="promising"),
    ]
    ranked = mod.map_value_order(items)
    assert [it["id"] for it in ranked] == ["promising", "desert-probe"]
    stamped = {it["id"]: it for it in ranked}
    assert stamped["desert-probe"]["map_promise"] == pytest.approx(
        mod.MAP_PROMISE_FLOOR)
    assert stamped["desert-probe"]["map_value"] > 0


def test_contamination_discount(mod):
    items = [
        _item(pair="eng>zz1", contamination="MEDIUM", item_id="medium"),
        _item(pair="eng>zz2", contamination="LOW", item_id="clean"),
    ]
    ranked = [it["id"] for it in mod.map_value_order(items)]
    assert ranked == ["clean", "medium"]


def test_cheaper_first_at_equal_novelty(mod):
    items = [
        _item(pair="eng>zz1", cost=0.50, item_id="dear"),
        _item(pair="eng>zz2", cost=0.02, item_id="cheap"),
    ]
    ranked = [it["id"] for it in mod.map_value_order(items)]
    assert ranked == ["cheap", "dear"]


def test_missing_diagnostics_degrade_to_defaults(mod):
    """Published-slim item shape (no diagnostics) still ranks sanely —
    uninformed defaults, never a crash."""
    slim = {
        "id": "slim-1", "language_pair": "eng>zz7",
        "model": "deepl", "condition": "engine",
        "est_cost_usd": None, "contamination": None,
    }
    ranked = mod.map_value_order([slim])
    assert ranked[0]["map_value"] > 0
    assert ranked[0]["map_promise"] == pytest.approx(mod.S0_FALLBACK)


# ---------------------------------------------------------------------------
# Published-shape stability (both modes)
# ---------------------------------------------------------------------------

def test_map_diagnostics_never_published(mod):
    it = _item(pair="eng>zz1", domain="conv",
               connectivity=("bridge", 1.0), corpus_quality=0.62)
    (ranked_item,) = mod.map_value_order([it])
    slim = mod.slim_published_item(ranked_item)
    for field in ("map_novelty", "map_uncertainty", "map_promise",
                  "map_value", "cost_for_value", "edge_runs",
                  "map_connectivity", "map_connectivity_class",
                  "map_corpus_quality",
                  "prior_basis", "predicted_strength"):
        assert field not in slim
    # domain is a published corpus-quality marker, not a diagnostic.
    assert slim["domain"] == "conv"


# ---------------------------------------------------------------------------
# Operational loop: --refresh must carry map metadata through untouched
# ---------------------------------------------------------------------------

def test_refresh_preserves_map_metadata(mod, tmp_path):
    """If the founder flips the published queue to map mode, the delta
    refresh (and its edge-function twin, which mutates the same parsed
    metadata object) must preserve rank_mode / service_landscape / the map
    priority_model — dropping them would silently misdescribe the served
    ranking between full regenerations."""
    import json as _json

    items = [_item(pair="eng>pam"), _item(pair="eng>sna")]
    ranked = mod.map_value_order(items)
    queue = {
        "metadata": {
            "rank_mode": "map",
            "priority_model": "map-value v2 (survey mode): …",
            "map_value_parameters": {"map_value_version": "map-v2"},
            "service_landscape": {"card_languages": 3},
            "preview_policy": {"source_cap": 6, "conlang_codes": []},
            "open_items": len(ranked),
        },
        "items": [mod.slim_published_item(it) for it in ranked],
    }
    qpath = tmp_path / "queue.json"
    qpath.write_text(_json.dumps(queue), encoding="utf-8")

    summary = mod.run_refresh(
        qpath, offline=True, registry={"datasets": []},
    )
    refreshed = _json.loads(qpath.read_text(encoding="utf-8"))
    meta = refreshed["metadata"]
    assert meta["rank_mode"] == "map"
    assert meta["service_landscape"] == {"card_languages": 3}
    assert meta["map_value_parameters"] == {"map_value_version": "map-v2"}
    assert meta["priority_model"].startswith("map-value v2")
    assert meta["open_items"] == 2 and summary["dropped"] == 0
    assert "refreshed_at" in meta
    # Item order (the map ranking) is untouched by an offline refresh.
    assert [it["id"] for it in refreshed["items"]] \
        == [it["id"] for it in queue["items"]]


# ---------------------------------------------------------------------------
# Desert ledger
# ---------------------------------------------------------------------------

def test_service_landscape_ledger(mod):
    items = [_item(pair="eng>pam"), _item(pair="eng>sna")]
    registry_datasets = [
        # NC corpus mentioning crk: registry-visible but not queueable.
        {"language_pair": {"source": "eng", "target": "crk"}},
    ]
    engine_lane = {"someengine": frozenset({"yor", "eng"})}
    ledger = mod.build_service_landscape(
        items, registry_datasets, engine_lane,
    )
    n_cards = len(list(CARDS_DIR.glob("*.json")))
    assert ledger["card_languages"] == n_cards
    assert ledger["queue_languages"] == 3          # eng, pam, sna
    assert ledger["invisible_languages"] == n_cards - 3
    reasons = ledger["invisible_reasons"]
    assert reasons["corpus_not_queueable"] == 1     # crk
    assert reasons["no_corpus_but_engine_coverage"] == 1  # yor
    assert (reasons["corpus_not_queueable"]
            + reasons["no_registry_corpus"]) == ledger["invisible_languages"]
    assert ledger["families_visible"] >= 1
    assert ledger["families_on_cards"] > ledger["families_visible"]
    assert len(ledger["largest_invisible_families"]) == 20
    sizes = [f["languages"] for f in ledger["largest_invisible_families"]]
    assert sizes == sorted(sizes, reverse=True)


class TestPublishedQueuePolicy:
    """The regen pipelines invoke the generator BARE, so the argparse
    DEFAULT is the de-facto published-queue policy. The founder flipped the
    served queue to map-value survey ordering (2026-07-19, commit
    283524f9a); a lagging default silently reverted that flip on the first
    website ensure-network-artifacts regen (caught same day). These pins
    keep the policy, its default, and the pipeline honest together."""

    def test_default_rank_mode_is_the_published_policy(self):
        src = SCRIPT.read_text(encoding="utf-8")
        i = src.index('"--rank-mode"')
        window = src[i:i + 300]
        assert 'default="map"' in window, (
            "generate_sweep_queue --rank-mode must DEFAULT to the published "
            "map-value policy — regen pipelines run the script bare, so a "
            "different default silently reverts the founder's queue flip"
        )

    def test_website_regen_pipeline_states_the_policy(self):
        ensure = (ARENA_ROOT.parent / "cli" / "website" / "scripts"
                  / "ensure-network-artifacts.mjs")
        if not ensure.is_file():
            pytest.skip("cli/website not present (standalone arena checkout)")
        src = ensure.read_text(encoding="utf-8")
        assert "--rank-mode" in src and "'map'" in src, (
            "ensure-network-artifacts must pass --rank-mode map explicitly "
            "— the pipeline states the policy it serves"
        )

    def test_map_metadata_declares_v2_and_its_parameters(self):
        """The served metadata must describe the ranking that actually
        ordered it: the map branch declares map-value v2, publishes the
        factor values (map_value_parameters), and never leaks an internal
        docs/ path into the public artifact (doc-set rule)."""
        src = SCRIPT.read_text(encoding="utf-8")
        i = src.index('queue["metadata"]["rank_mode"] = "map"')
        window = src[i:i + 4000]
        assert "map-value v2 (survey mode)" in window
        assert '"map_value_parameters"' in window
        assert '"connectivity_factors"' in window
        assert "docs/QUEUE_ALGORITHM_REVIEW" not in window, (
            "public queue metadata must not reference internal docs/ paths"
        )

    def test_connectivity_factors_cover_all_classes(self):
        """The factor table and the classifier vocabulary stay in lockstep;
        every factor lies in (0, 1] with bridge at full credit."""
        import importlib.util as _ilu
        spec = _ilu.spec_from_file_location("gsq_policy_pin", SCRIPT)
        m = _ilu.module_from_spec(spec)
        spec.loader.exec_module(m)
        assert set(m.MAP_CONNECTIVITY_FACTORS) == {
            "bridge", "interior", "island"}
        assert m.MAP_CONNECTIVITY_FACTORS["bridge"] == 1.0
        for v in m.MAP_CONNECTIVITY_FACTORS.values():
            assert 0.0 < v <= 1.0
