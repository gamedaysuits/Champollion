"""Tests for the 2026-07-12 ranking remedies in scripts/generate_sweep_queue.py.

Four founder-approved adjustments to the ecv-v3 queue (see the script's
"2026-07-12 ranking remedies" docstring section):

  1. contamination multiplier on ECV (LOW 1.0 / MEDIUM 0.4 / HIGH 0.1,
     unknown treated as MEDIUM) — affects the FULL ranking;
  2. frontier interleave — every 5th slot of the final order carries the
     best remaining FRONTIER_MODELS item — affects the FULL ranking order;
  3. per-source-hub diversity cap in the top-N preview (PREVIEW ONLY);
  4. constructed-language exclusion from the preview (PREVIEW ONLY),
     data-driven from the language cards (Glottolog arti1236 bucket).

All tests run on synthetic item dicts — no network, no full generation.
The conlang tests read the real language cards on disk (tlh/epo/jpn),
which is the point: the determination is data, not a hardcoded set.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ARENA_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ARENA_ROOT / "scripts" / "generate_sweep_queue.py"
CARDS_DIR = ARENA_ROOT.parent / "cli" / "shared" / "language-cards"


@pytest.fixture(scope="module")
def queue_mod():
    spec = importlib.util.spec_from_file_location(
        "generate_sweep_queue_remedies", SCRIPT,
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _item(i, *, model="anthropic/claude-haiku-4.5", cond="naive",
          ecv=1.0, cost=0.1, pair="eng>deu", contamination="LOW"):
    """Minimal synthetic queue item carrying only ranking-relevant fields."""
    return {
        "id": f"it-{i:03d}",
        "language_pair": pair,
        "corpus_id": f"corpus-{i:03d}",
        "contamination": contamination,
        "model": model,
        "condition": cond,
        "est_cost_usd": cost,
        "ecv_per_usd": ecv,
    }


# ---------------------------------------------------------------------------
# Remedy 1 — contamination multiplier in ECV
# ---------------------------------------------------------------------------

class TestContaminationFactor:
    def test_factor_table(self, queue_mod):
        assert queue_mod.contamination_ecv_factor("LOW") == 1.0
        assert queue_mod.contamination_ecv_factor("MEDIUM") == 0.4
        assert queue_mod.contamination_ecv_factor("HIGH") == 0.1

    def test_case_and_whitespace_insensitive(self, queue_mod):
        assert queue_mod.contamination_ecv_factor("low") == 1.0
        assert queue_mod.contamination_ecv_factor(" High ") == 0.1

    def test_unknown_or_missing_treated_as_medium(self, queue_mod):
        """Conservative default: never assume an ungraded corpus is clean."""
        medium = queue_mod.CONTAMINATION_ECV_FACTORS["MEDIUM"]
        assert queue_mod.contamination_ecv_factor(None) == medium
        assert queue_mod.contamination_ecv_factor("") == medium
        assert queue_mod.contamination_ecv_factor("SOMETHING-NEW") == medium

    def test_medium_item_ranks_below_low_at_equal_raw_ecv(self, queue_mod):
        """Two items with identical raw ΔΦ/cost: after the contamination
        multiplier, the LOW item must outrank the MEDIUM item, and MEDIUM
        must outrank HIGH."""
        raw_ecv = 2.5
        items = []
        for i, grade in enumerate(("MEDIUM", "LOW", "HIGH")):
            it = _item(i, contamination=grade)
            it["ecv_per_usd"] = (
                raw_ecv * queue_mod.contamination_ecv_factor(grade)
            )
            items.append(it)
        items.sort(key=queue_mod.ecv_sort_key)
        assert [it["contamination"] for it in items] == [
            "LOW", "MEDIUM", "HIGH",
        ]

    def test_discounted_but_never_dropped(self, queue_mod):
        """HIGH contamination discounts to a positive factor — the item
        stays rankable (relative-lane value), never zeroed out."""
        assert 0 < queue_mod.contamination_ecv_factor("HIGH") < \
            queue_mod.contamination_ecv_factor("MEDIUM") < \
            queue_mod.contamination_ecv_factor("LOW")


# ---------------------------------------------------------------------------
# Remedy 2 — frontier interleave
# ---------------------------------------------------------------------------

FRONTIER = "anthropic/claude-fable-5"
FRONTIER_2 = "openai/gpt-5.6-terra-pro"   # 2026-08-24 refresh: succeeded gpt-5.5
CHEAP = "anthropic/claude-haiku-4.5"


class TestFrontierInterleave:
    def test_frontier_constants(self, queue_mod):
        assert FRONTIER in queue_mod.FRONTIER_MODELS
        assert FRONTIER_2 in queue_mod.FRONTIER_MODELS
        assert CHEAP not in queue_mod.FRONTIER_MODELS
        assert queue_mod.FRONTIER_INTERLEAVE_EVERY == 5

    def test_every_5th_slot_is_frontier_while_any_remain(self, queue_mod):
        # 20 cheap items rank naturally 1..20; 4 frontier items sit at the
        # bottom (low ECV) — exactly where pure cost-greedy leaves them.
        cheap = [_item(i, ecv=100 - i) for i in range(20)]
        frontier = [
            _item(100 + j, model=FRONTIER, ecv=1 - j * 0.1)
            for j in range(4)
        ]
        woven = queue_mod.interleave_frontier(cheap + frontier)
        assert len(woven) == 24
        # 1-indexed slots 5, 10, 15, 20 carry the frontier items, best first.
        for k, slot in enumerate((5, 10, 15, 20)):
            assert woven[slot - 1]["model"] == FRONTIER
            assert woven[slot - 1]["id"] == f"it-{100 + k:03d}"
        # Frontier exhausted after slot 20 → natural order continues.
        assert all(it["model"] == CHEAP for it in woven[20:])
        # Non-frontier items keep their relative order (shift down only).
        cheap_ids = [it["id"] for it in woven if it["model"] == CHEAP]
        assert cheap_ids == [it["id"] for it in cheap]

    def test_no_frontier_items_leaves_order_untouched(self, queue_mod):
        items = [_item(i, ecv=10 - i) for i in range(12)]
        assert queue_mod.interleave_frontier(items) == items

    def test_naturally_ranked_frontier_item_is_not_duplicated(self, queue_mod):
        # A frontier item already at natural slot 2 keeps it; the reserved
        # 5th slot takes the NEXT best frontier item.
        items = [
            _item(0, ecv=10),
            _item(1, model=FRONTIER, ecv=9),   # natural slot 2
            _item(2, ecv=8),
            _item(3, ecv=7),
            _item(4, ecv=6),
            _item(5, ecv=5),
            _item(6, model=FRONTIER_2, ecv=1),  # pulled up to slot 5
        ]
        woven = queue_mod.interleave_frontier(items)
        assert [it["id"] for it in woven].count("it-001") == 1
        assert woven[1]["id"] == "it-001"       # kept its natural slot
        assert woven[4]["id"] == "it-006"       # reserved slot -> next best
        assert len(woven) == len(items)
        assert {it["id"] for it in woven} == {it["id"] for it in items}

    def test_short_lists_pass_through(self, queue_mod):
        items = [_item(0), _item(1, model=FRONTIER)]
        assert queue_mod.interleave_frontier(items) == items
        assert queue_mod.interleave_frontier([]) == []


# ---------------------------------------------------------------------------
# Remedy 3 — per-source-hub diversity cap (preview only)
# ---------------------------------------------------------------------------

class TestPreviewSourceCap:
    def _queue(self, items):
        return {"metadata": {}, "items": items}

    def test_hub_capped_at_six_in_preview(self, queue_mod):
        # The observed failure mode: 20 jpn>X items outrank everything.
        jpn = [_item(i, ecv=100 - i, pair=f"jpn>xa{i}") for i in range(20)]
        # Fill items from 10 DISTINCT source hubs (none near the cap).
        other = [_item(100 + i, ecv=10 - i, pair=f"s{i:02d}>xb{i}")
                 for i in range(10)]
        preview = queue_mod.build_queue_preview(
            self._queue(jpn + other), full_queue_bytes=1000,
        )
        srcs = [it["language_pair"].split(">")[0] for it in preview["items"]]
        assert srcs.count("jpn") == queue_mod.PREVIEW_SOURCE_CAP == 6
        # The preview back-fills with the next eligible items: 6 jpn + 10
        # single-source items (the cap binds per hub, not globally).
        assert preview["preview_count"] == 16
        # The best 6 jpn items are the ones shown, in ranking order.
        shown_jpn = [it["id"] for it in preview["items"]
                     if it["language_pair"].startswith("jpn>")]
        assert shown_jpn == [f"it-{i:03d}" for i in range(6)]

    def test_cap_binds_every_hub_not_just_the_biggest(self, queue_mod):
        jpn = [_item(i, ecv=100 - i, pair=f"jpn>xa{i}") for i in range(20)]
        eng = [_item(100 + i, ecv=10 - i, pair=f"eng>xb{i}")
               for i in range(10)]
        preview = queue_mod.build_queue_preview(
            self._queue(jpn + eng), full_queue_bytes=1000,
        )
        srcs = [it["language_pair"].split(">")[0] for it in preview["items"]]
        assert srcs.count("jpn") == 6
        assert srcs.count("eng") == 6
        assert preview["preview_count"] == 12

    def test_over_cap_items_stay_in_full_queue(self, queue_mod):
        jpn = [_item(i, ecv=100 - i, pair=f"jpn>xa{i}") for i in range(8)]
        queue = self._queue(jpn)
        preview = queue_mod.build_queue_preview(queue, full_queue_bytes=1)
        assert preview["preview_count"] == 6
        # Nothing was removed from the full work-list.
        assert len(queue["items"]) == 8
        assert preview["full_queue"]["items"] == 8

    def test_policy_is_declared_in_the_artifact(self, queue_mod):
        preview = queue_mod.build_queue_preview(
            self._queue([_item(0)]), full_queue_bytes=1,
        )
        policy = preview["preview_policy"]
        assert policy["source_cap"] == 6
        assert policy["exclude_constructed"] is True
        # eng/deu are natural languages — the derived list is empty.
        assert policy["constructed_language_codes"] == []


# ---------------------------------------------------------------------------
# Remedy 4 — conlang exclusion from the preview (data-driven, cards SSOT)
# ---------------------------------------------------------------------------

class TestConlangExclusion:
    def test_detection_reads_the_language_cards(self, queue_mod):
        """tlh (Klingon) and epo (Esperanto) sit in Glottolog's Artificial
        Language bucket (arti1236) per their cards; jpn does not; an
        uncarded code is never presumed constructed."""
        if not (CARDS_DIR / "tlh.json").is_file():
            pytest.skip("language cards not present (standalone checkout)")
        assert queue_mod.is_constructed_language("tlh") is True
        assert queue_mod.is_constructed_language("epo") is True
        assert queue_mod.is_constructed_language("jpn") is False
        assert queue_mod.is_constructed_language("zz9") is False
        assert queue_mod.is_constructed_language("") is False
        assert queue_mod.is_constructed_language(None) is False

    def test_conlang_items_excluded_from_preview_not_queue(self, queue_mod):
        if not (CARDS_DIR / "tlh.json").is_file():
            pytest.skip("language cards not present (standalone checkout)")
        items = [
            _item(0, ecv=100, pair="jpn>tlh"),   # target conlang — top ECV
            _item(1, ecv=90, pair="epo>eng"),    # source conlang
            _item(2, ecv=80, pair="jpn>kor"),
            _item(3, ecv=70, pair="eng>deu"),
        ]
        queue = {"metadata": {}, "items": items}
        preview = queue_mod.build_queue_preview(queue, full_queue_bytes=1)
        shown = [it["language_pair"] for it in preview["items"]]
        assert shown == ["jpn>kor", "eng>deu"]
        # Full queue keeps the conlang items with their real ranking.
        assert [it["language_pair"] for it in queue["items"]][:2] == [
            "jpn>tlh", "epo>eng",
        ]
        assert preview["full_queue"]["items"] == 4


# ---------------------------------------------------------------------------
# Preview-policy parity contract (edge function reads the policy AS DATA)
# ---------------------------------------------------------------------------

class TestPreviewPolicyParity:
    """The preview policy travels IN THE DATA (queue metadata
    ``preview_policy``) so the card-less regenerate-queue edge function
    (mt-eval-arena/supabase/functions/regenerate-queue/lib.ts,
    ``selectPreviewItems``) can apply the identical selection. These tests
    pin the Python side of that contract; the TS side is pinned by its own
    deno suite (mt-eval-arena/supabase/functions/regenerate-queue/
    lib_test.ts mirrors these cases)."""

    def test_derived_codes_from_items(self, queue_mod):
        """tlh appears in the codes list exactly when a tlh item exists;
        natural languages (jpn/kor/eng) never do."""
        if not (CARDS_DIR / "tlh.json").is_file():
            pytest.skip("language cards not present (standalone checkout)")
        items = [
            _item(0, pair="jpn>tlh"),
            _item(1, pair="epo>eng"),
            _item(2, pair="jpn>kor"),
        ]
        policy = queue_mod.build_preview_policy(items)
        assert policy["source_cap"] == queue_mod.PREVIEW_SOURCE_CAP == 6
        assert policy["exclude_constructed"] is True
        assert policy["constructed_language_codes"] == ["epo", "tlh"]

    def test_codes_limited_to_languages_in_queue(self, queue_mod):
        """epo is constructed but absent from this queue → not listed
        (the published list stays small and data-derived)."""
        if not (CARDS_DIR / "tlh.json").is_file():
            pytest.skip("language cards not present (standalone checkout)")
        policy = queue_mod.build_preview_policy([_item(0, pair="jpn>tlh")])
        assert policy["constructed_language_codes"] == ["tlh"]

    def test_preview_block_reuses_metadata_policy(self, queue_mod):
        """build_queue_preview echoes the full queue's metadata block
        verbatim when present, so the two artifacts can never disagree."""
        items = [_item(0)]
        meta_policy = queue_mod.build_preview_policy(items)
        queue = {"metadata": {"preview_policy": meta_policy}, "items": items}
        preview = queue_mod.build_queue_preview(queue, full_queue_bytes=1)
        assert preview["preview_policy"] == meta_policy

    def test_refresh_upgrades_pre_policy_queue_from_cards(
            self, queue_mod, tmp_path):
        """A base queue from BEFORE the policy existed gains a card-derived
        block on its first local refresh — the one remaining card touch in
        the refresh path (the card-less edge function instead falls back
        to the plain top-N slice for such queues): tlh listed because a
        tlh item exists, jpn absent."""
        if not (CARDS_DIR / "tlh.json").is_file():
            pytest.skip("language cards not present (standalone checkout)")
        queue = {"metadata": {}, "items": [
            _item(0, pair="jpn>tlh"),
            _item(1, pair="jpn>kor"),
        ]}
        qpath = tmp_path / "queue.json"
        qpath.write_text(json.dumps(queue), encoding="utf-8")
        queue_mod.run_refresh(qpath, offline=True, registry={"datasets": []})
        refreshed = json.loads(qpath.read_text(encoding="utf-8"))
        policy = refreshed["metadata"]["preview_policy"]
        assert policy["source_cap"] == 6
        assert policy["exclude_constructed"] is True
        assert policy["constructed_language_codes"] == ["tlh"]
        # And the rebuilt preview echoes the exact same block.
        preview = json.loads(
            (tmp_path / "queue-preview.json").read_text(encoding="utf-8"))
        assert preview["preview_policy"] == policy

    def test_refresh_consumes_stamped_policy_verbatim(
            self, queue_mod, tmp_path):
        """A stamped preview_policy is DATA: the refresh consumes it
        verbatim (edge-function parity) instead of re-deriving from the
        cards, so a refresh where the cards are unreachable can never
        silently blank the codes. 'qqq' has no language card and jpn's
        card is natural — both stay in the codes list and drive the
        selection anyway. No card access needed: no skip guard."""
        stamped = {
            "source_cap": 1,
            "exclude_constructed": True,
            "constructed_language_codes": ["qqq", "tlh"],
        }
        queue = {"metadata": {"preview_policy": dict(stamped)}, "items": [
            _item(0, pair="jpn>tlh"),   # excluded: stamped code
            _item(1, pair="qqq>eng"),   # excluded: stamped code w/o a card
            _item(2, pair="jpn>kor"),   # picked (jpn 1/1)
            _item(3, pair="jpn>deu"),   # skipped: stamped cap 1
            _item(4, pair="fra>eng"),   # picked
        ]}
        qpath = tmp_path / "queue.json"
        qpath.write_text(json.dumps(queue), encoding="utf-8")
        queue_mod.run_refresh(qpath, offline=True, registry={"datasets": []})
        refreshed = json.loads(qpath.read_text(encoding="utf-8"))
        assert refreshed["metadata"]["preview_policy"] == stamped
        preview = json.loads(
            (tmp_path / "queue-preview.json").read_text(encoding="utf-8"))
        assert preview["preview_policy"] == stamped
        # The selection follows the block it publishes — never live cards.
        assert [it["language_pair"] for it in preview["items"]] == [
            "jpn>kor", "fra>eng",
        ]

    def test_malformed_source_cap_fails_open(self, queue_mod):
        """A cap that isn't a real finite number means NO cap, never cap 0
        — the TS twin's Number(null) is 0, which would silently empty the
        preview (booleans are not caps either: True must not bind at 1)."""
        items = [_item(i, pair=f"jpn>x{i:02d}") for i in range(8)]
        for bad_cap in (None, True, "6", float("nan")):
            policy = {"source_cap": bad_cap, "exclude_constructed": True,
                      "constructed_language_codes": []}
            picked = queue_mod.select_preview_items(items, 25, policy=policy)
            assert len(picked) == 8, f"cap {bad_cap!r} must fail open"


# ---------------------------------------------------------------------------
# Budget tiers — "what does $X buy?" (2026-08-24 queue reassessment)
# ---------------------------------------------------------------------------

class TestBudgetTiers:
    def test_tier_constants(self, queue_mod):
        assert queue_mod.BUDGET_TIERS_USD == (1.0, 10.0, 100.0, 1000.0)

    def test_greedy_prefix_with_skip(self, queue_mod):
        """The walk takes items in ranking order while they fit, SKIPS an
        unaffordable item, and keeps filling with later cheaper ones — the
        greedy rule the ECV ranking itself is built on."""
        items = [
            _item(0, cost=0.6, pair="eng>deu"),
            _item(1, cost=0.6, pair="eng>fra"),   # skipped at $1 (0.6+0.6)
            _item(2, cost=0.3, pair="eng>spa"),   # taken (0.6+0.3)
            _item(3, cost=0.2, pair="eng>ita"),   # skipped (0.9+0.2 > 1)
        ]
        for it, pr in zip(items, range(1, 5)):
            it["priority"] = pr
        tiers = queue_mod.build_budget_tiers(items, tiers=(1.0,))
        t = tiers[0]
        assert t["items"] == 2
        assert t["total_cost_usd"] == 0.9
        assert t["pairs"] == 2
        assert t["models"] == 1
        assert t["max_priority"] == 3

    def test_costless_items_never_counted(self, queue_mod):
        items = [_item(0, cost=0.5)]
        items[0]["priority"] = 1
        bad = _item(1)
        bad["est_cost_usd"] = None
        bad["priority"] = 2
        tiers = queue_mod.build_budget_tiers([bad, items[0]], tiers=(1.0,))
        assert tiers[0]["items"] == 1
        assert tiers[0]["max_priority"] == 1

    def test_preview_carries_budget_tiers(self, queue_mod):
        queue = {"metadata": {}, "items": [_item(i, cost=0.1) for i in range(3)]}
        preview = queue_mod.build_queue_preview(queue, full_queue_bytes=123)
        assert [t["budget_usd"] for t in preview["budget_tiers"]] == [
            1.0, 10.0, 100.0, 1000.0]
        assert preview["budget_tiers"][0]["items"] == 3

    def test_shared_vectors_fixture(self, queue_mod):
        """The budget-tier TWINS replay one golden fixture
        (shared/budget-tier-vectors.json) — this side and the deno suite
        (regenerate-queue/lib_test.ts) must both reproduce `expected`
        exactly, so the two implementations cannot drift apart the way
        hand-copied parallel tests can."""
        import json
        from pathlib import Path
        fx = json.loads(
            (Path(__file__).resolve().parents[2] / "shared"
             / "budget-tier-vectors.json").read_text(encoding="utf-8"))
        got = queue_mod.build_budget_tiers(
            fx["items"], tiers=tuple(float(t) for t in fx["tiers_usd"]))
        expected = [{**e, "budget_usd": float(e["budget_usd"])}
                    for e in fx["expected"]]
        assert got == expected
