import pytest

from nmt_forge.errors import GenerationHeadroomError
from nmt_forge.training.backends import DummyBackend
from nmt_forge.training.selection import check_generation_headroom, select_checkpoint

DEV = [{"source": f"src {i} alpha beta", "target": f"tgt {i} gamma delta"}
       for i in range(10)]


def test_headroom_refuses_the_ledger_case():
    # the catalogued numbers: cap 160, max ref 107 tokens → 107×1.5 = 160.5 > 160
    refs = ["w " * 106 + "w"]          # 107 whitespace tokens
    with pytest.raises(GenerationHeadroomError) as e:
        check_generation_headroom(refs, 160, lambda t: len(t.split()))
    msg = str(e.value)
    assert "107" in msg and "161" in msg and "fix:" in msg
    report = check_generation_headroom(refs, 256, lambda t: len(t.split()))
    assert report["max_ref_tokens"] == 107 and report["required_min"] == 161


def test_loss_selection_picks_min_dev_loss():
    backend = DummyBackend(dev_losses=[3.0, 1.5, 2.0])
    result = backend.train([], DEV, {}, "/tmp/x")
    report = select_checkpoint(result, metric_spec="loss", backend=backend,
                               dev_rows=DEV, decode_params={})
    assert report.selected.id == "ckpt-2"


def test_generation_selection_can_disagree_with_loss():
    # ckpt-2 has the best LOSS; ckpt-3 decodes dev PERFECTLY. The generation
    # metric must pick ckpt-3 — "eval-loss is enough" is a measurable choice
    # here, not an assumption.
    perfect = {r["source"]: r["target"] for r in DEV}
    backend = DummyBackend(dev_losses=[3.0, 1.5, 2.0],
                           decode_tables={"ckpt-3": perfect})
    result = backend.train([], DEV, {}, "/tmp/x")
    report = select_checkpoint(
        result, metric_spec="generation:chrf++", backend=backend,
        dev_rows=DEV, decode_params={"max_new_tokens": 64},
        top_k=3, n_bootstrap=100,
    )
    assert report.selected.id == "ckpt-3"
    by_id = {row["id"]: row for row in report.per_checkpoint}
    assert by_id["ckpt-3"]["chrf++"] == pytest.approx(100.0, abs=0.1)
    # every per-checkpoint score carries its CI
    assert all("ci" in row for row in report.per_checkpoint)
    assert report.headroom["max_new_tokens"] == 64


def test_generation_selection_respects_top_k():
    perfect = {r["source"]: r["target"] for r in DEV}
    # the perfect decoder is the WORST-loss checkpoint and top_k=2 excludes it
    backend = DummyBackend(dev_losses=[1.0, 1.1, 9.9],
                           decode_tables={"ckpt-3": perfect})
    result = backend.train([], DEV, {}, "/tmp/x")
    report = select_checkpoint(
        result, metric_spec="generation:chrf++", backend=backend,
        dev_rows=DEV, decode_params={"max_new_tokens": 64},
        top_k=2, n_bootstrap=50,
    )
    assert report.selected.id != "ckpt-3"
    assert len(report.per_checkpoint) == 2


def test_headroom_runs_before_decoding():
    backend = DummyBackend()
    result = backend.train([], DEV, {}, "/tmp/x")
    with pytest.raises(GenerationHeadroomError):
        select_checkpoint(result, metric_spec="generation:chrf++",
                          backend=backend, dev_rows=DEV,
                          decode_params={"max_new_tokens": 2}, n_bootstrap=50)
