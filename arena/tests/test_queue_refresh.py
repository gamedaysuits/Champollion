"""Server-side delta refresh (generate_sweep_queue.py).

Pins the pure helpers behind the event-driven regeneration — drop completed
items, fold new results into the mesh, rebuild the preview — and the
``run_refresh`` orchestrator that rewrites the served artifacts in place. These
are the SSOT + portable twin of the regenerate-queue Supabase Edge Function; if
the drop/fold rules change here, mirror them there.

The script is stdlib-only and not a package, so it's imported via importlib.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ARENA_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ARENA_ROOT / "scripts" / "generate_sweep_queue.py"


@pytest.fixture(scope="module")
def mod():
    spec = importlib.util.spec_from_file_location("generate_sweep_queue", SCRIPT)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def _item(corpus, model, cond):
    return {
        "id": f"{corpus}__{model}__{cond}",
        "language_pair": "eng>ilo",
        "corpus_id": corpus,
        "model": model,
        "condition": cond,
        "est_cost_usd": 0.01,
    }


# ---------------------------------------------------------------------------
# Drop completed items
# ---------------------------------------------------------------------------

class TestDropCompleted:
    def test_drops_exact_covered_combo(self, mod):
        items = [
            _item("eval-eng-ilo", "anthropic/claude-haiku-4.5", "naive"),
            _item("eval-eng-ilo", "google/gemini-3.5-flash", "naive"),
        ]
        # coverage uses the SHORT model form + token, as fetch_results emits.
        covered = {("eval-eng-ilo", "claude-haiku-4.5", "naive")}
        kept = mod.drop_completed_items(items, covered)
        assert [it["model"] for it in kept] == ["google/gemini-3.5-flash"]

    def test_coached_label_variants_normalize(self, mod):
        item = _item("eval-eng-ilo", "m/x", "coached-v2")
        covered = {("eval-eng-ilo", "x", "coached")}
        assert mod.item_is_covered(item, covered) is True

    def test_item_missing_keys_is_kept(self, mod):
        assert mod.item_is_covered({"condition": "naive"}, {("a", "b", "naive")}) is False

    def test_empty_coverage_keeps_all(self, mod):
        items = [_item("c", "m/x", "naive")]
        assert mod.drop_completed_items(items, set()) == items

    def test_engine_item_covered_by_any_condition(self, mod):
        # An engine run publishes under its real prompt-condition label
        # ("naive" by default) — the engine item must still drop.
        item = _item("eval-eng-ilo", "google-translate", "engine")
        covered = {("eval-eng-ilo", "google-translate", "naive")}
        assert mod.item_is_covered(item, covered) is True
        assert mod.drop_completed_items([item], covered) == []

    def test_engine_item_not_covered_by_other_engine(self, mod):
        item = _item("eval-eng-ilo", "deepl", "engine")
        covered = {("eval-eng-ilo", "google-translate", "naive")}
        assert mod.item_is_covered(item, covered) is False

    def test_llm_item_still_condition_exact(self, mod):
        # The condition-agnostic rule is ENGINE-ONLY: a naive LLM run must
        # not cover the coached item for the same (corpus, model).
        item = _item("eval-eng-ilo", "m/x", "coached")
        covered = {("eval-eng-ilo", "x", "naive")}
        assert mod.item_is_covered(item, covered) is False


# ---------------------------------------------------------------------------
# Fold results into the mesh
# ---------------------------------------------------------------------------

def _base_mesh():
    return {
        "nodes": [{"id": "eng", "lat": 0, "lng": 0}, {"id": "ilo"}],
        "edges": [
            {"a": "eng", "b": "ilo", "size": 50, "status": "registered",
             "best_chrf": None, "reliability": None, "tier": "registered",
             "runs": []},
        ],
    }


class TestFoldResultsIntoMesh:
    def test_result_lights_up_edge(self, mod):
        mesh = _base_mesh()
        token_pair = {"eval-eng-ilo": ("eng", "ilo")}
        results = [{"token": "eval-eng-ilo", "strength": 0.62,
                    "submitted_at": "2026-06-22T00:00:00Z"}]
        mod.fold_results_into_mesh(mesh, results, token_pair)
        edge = mesh["edges"][0]
        assert edge["status"] == "measured"
        assert edge["best_chrf"] == 62.0
        assert edge["runs"] == [["2026-06-22T00:00:00Z", 62.0]]
        assert mesh["measured_edges"] == 1
        assert "refreshed_at" in mesh

    def test_node_coords_preserved(self, mod):
        mesh = _base_mesh()
        mod.fold_results_into_mesh(
            mesh,
            [{"token": "eval-eng-ilo", "strength": 0.5,
              "submitted_at": "2026-06-22T00:00:00Z"}],
            {"eval-eng-ilo": ("eng", "ilo")},
        )
        # The fold must not disturb the base node layout (coords come from the
        # last full generation, which has the language cards).
        assert mesh["nodes"][0]["lat"] == 0

    def test_refold_is_idempotent_not_double_counted(self, mod):
        mesh = _base_mesh()
        tp = {"eval-eng-ilo": ("eng", "ilo")}
        results = [{"token": "eval-eng-ilo", "strength": 0.62,
                    "submitted_at": "2026-06-22T00:00:00Z"}]
        mod.fold_results_into_mesh(mesh, results, tp)
        mod.fold_results_into_mesh(mesh, results, tp)  # same board again
        assert len(mesh["edges"][0]["runs"]) == 1  # not 2

    def test_new_registered_edge_from_registry_appended(self, mod):
        mesh = _base_mesh()
        registry = {"datasets": [
            {"id": "eval-eng-quy", "size": 90,
             "language_pair": {"source": "eng", "target": "quy"}},
        ]}
        mod.fold_results_into_mesh(mesh, [], {}, registry)
        pairs = {frozenset((e["a"], e["b"])) for e in mesh["edges"]}
        assert frozenset(("eng", "quy")) in pairs
        new = next(e for e in mesh["edges"]
                   if frozenset((e["a"], e["b"])) == frozenset(("eng", "quy")))
        assert new["status"] == "registered"
        assert new["size"] == 90

    def test_self_pair_in_registry_is_skipped(self, mod):
        mesh = _base_mesh()
        registry = {"datasets": [
            {"id": "x", "language_pair": {"source": "eng", "target": "eng"}},
        ]}
        before = len(mesh["edges"])
        mod.fold_results_into_mesh(mesh, [], {}, registry)
        assert len(mesh["edges"]) == before


# ---------------------------------------------------------------------------
# run_refresh — end-to-end over tmp artifacts with an injected board
# ---------------------------------------------------------------------------

class TestRunRefresh:
    def _seed(self, tmp_path):
        queue = {
            "metadata": {"open_items": 2},
            "items": [
                _item("eval-eng-ilo", "anthropic/claude-haiku-4.5", "naive"),
                _item("eval-eng-quy", "anthropic/claude-haiku-4.5", "naive"),
            ],
        }
        (tmp_path / "queue.json").write_text(json.dumps(queue), encoding="utf-8")
        (tmp_path / "mesh.json").write_text(json.dumps(_base_mesh()), encoding="utf-8")
        return tmp_path / "queue.json"

    def test_refresh_drops_completed_and_rewrites_all_three(self, mod, tmp_path):
        qpath = self._seed(tmp_path)
        registry = {"datasets": [
            {"id": "eval-eng-ilo", "path": "x/eng-ilo.json", "size": 50,
             "language_pair": {"source": "eng", "target": "ilo"}},
            {"id": "eval-eng-quy", "path": "x/eng-quy.json", "size": 90,
             "language_pair": {"source": "eng", "target": "quy"}},
        ]}
        # eng-ilo is now on the board; eng-quy is freshly registered, no run.
        coverage = {("eval-eng-ilo", "claude-haiku-4.5", "naive")}
        results = [{"token": "eval-eng-ilo", "strength": 0.7,
                    "submitted_at": "2026-06-22T00:00:00Z"}]

        summary = mod.run_refresh(
            qpath, fetch=lambda: (coverage, results), registry=registry,
        )
        assert summary["dropped"] == 1
        assert summary["remaining"] == 1

        queue = json.loads(qpath.read_text())
        assert [it["corpus_id"] for it in queue["items"]] == ["eval-eng-quy"]
        assert queue["metadata"]["open_items"] == 1

        # Preview-policy parity: the refreshed FULL queue must carry the
        # policy block the regenerate-queue edge function consumes (codes
        # re-derived from the surviving items; eng/quy are natural, so the
        # derived conlang list is empty — with or without cards on disk).
        policy = queue["metadata"]["preview_policy"]
        assert policy["source_cap"] == 6
        assert policy["exclude_constructed"] is True
        assert policy["constructed_language_codes"] == []

        preview = json.loads((tmp_path / "queue-preview.json").read_text())
        assert preview["full_queue"]["items"] == 1
        assert preview["preview_policy"] == policy

        mesh = json.loads((tmp_path / "mesh.json").read_text())
        ilo = next(e for e in mesh["edges"]
                   if frozenset((e["a"], e["b"])) == frozenset(("eng", "ilo")))
        assert ilo["status"] == "measured" and ilo["best_chrf"] == 70.0

    def test_missing_base_queue_fails_loud(self, mod, tmp_path):
        with pytest.raises(SystemExit):
            mod.run_refresh(tmp_path / "queue.json",
                            fetch=lambda: (set(), []),
                            registry={"datasets": []})

    def test_offline_refresh_drops_nothing(self, mod, tmp_path):
        qpath = self._seed(tmp_path)
        summary = mod.run_refresh(
            qpath, offline=True, registry={"datasets": []},
        )
        assert summary["dropped"] == 0
        assert summary["remaining"] == 2
