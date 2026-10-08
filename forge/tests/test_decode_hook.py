"""Decode-time feedback hook — plumbing through selection, run, evaluate.

The hook contract: callable(source, [(candidate, beam_score), ...]) -> str.
Reference implementation: the crk FST validity tie-break (validity inside a
narrow beam margin, never validity-first). These tests use a scripted hook +
DummyBackend candidate tables to pin that forge applies the hook at EVERY
decode site: checkpoint selection, the final dev report, and evaluate."""

import json

from nmt_forge.training.run import run
from tests.conftest import write_jsonl


def marker_hook(source, candidates):
    """Picks the candidate marked ⭐ (simulates validity beating beam order)."""
    for text, _ in candidates:
        if "⭐" in text:
            return text.replace("⭐", "").strip()
    return candidates[0][0]


def _setup(ws, tmp_path, dev_rows):
    gold = write_jsonl(tmp_path / "gold.jsonl", [
        {"source": f"g {i}", "target": f"t {i}"} for i in range(4)])
    # candidate tables: the top-beam candidate is WRONG; the ⭐ one matches
    # the reference — selection/report only look right if the hook ran
    cands = {f"ckpt-{k}": {r["source"]: [
        ("wrong beam output", -1.0),
        (f"⭐ {r['reference']}", -1.02),
    ] for r in dev_rows} for k in (1, 2, 3)}
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps({
        "run_name": "hooked", "workspace": str(ws.root),
        "data": {"gold": [str(gold)], "dev": "toy-dev"},
        "model": {"backend": "dummy",
                  "dummy": {"candidate_tables": cands}},
        "selection": {"metric": "generation:chrf++"},
        "decode": {"max_new_tokens": 32,
                   "hook": "tests.test_decode_hook:marker_hook",
                   "num_beams": 2},
    }))
    return cfg


def test_hook_applied_in_selection_and_dev_report(ws, dev_set, tmp_path):
    cfg = _setup(ws, tmp_path, dev_set)
    manifest = run(cfg)
    # the hook chose the reference-matching candidate → chrF++ saturates;
    # without the hook every decode is "wrong beam output"
    chrf = manifest["dev_report"]["scores"]["chrf++"]["score"]
    assert chrf > 95.0
    sel = manifest["stages"][0]["selection"]["per_checkpoint"]
    assert all(c["chrf++"] > 95.0 for c in sel)


def test_no_hook_means_top_beam(ws, dev_set, tmp_path):
    cfg_path = _setup(ws, tmp_path, dev_set)
    raw = json.loads(cfg_path.read_text())
    del raw["decode"]["hook"]
    cfg_path.write_text(json.dumps(raw))
    manifest = run(cfg_path)
    # candidate_tables only apply when a hook is present; the dummy falls
    # back to its echo decode → far from the references
    assert manifest["dev_report"]["scores"]["chrf++"]["score"] < 60.0


def test_unknown_decode_key_still_refused():
    import pytest

    from nmt_forge.errors import ConfigError
    from nmt_forge.training.config import RunConfig

    with pytest.raises(ConfigError, match="unknown key"):
        RunConfig.from_dict({
            "run_name": "x", "data": {"dev": "d"},
            "model": {"backend": "dummy"},
            "decode": {"hok": "typo:oops"},
        })
