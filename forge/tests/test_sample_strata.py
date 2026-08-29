import pytest

from nmt_forge.errors import StrataError
from nmt_forge.guards.sample_strata import stratified_sample, top_kind_share


def _skewed(n_cond=5400, n_rest=4600):
    # the ledger #7 shape: conditionals = 54% of the corpus
    rows = [{"kind": "cond", "i": i} for i in range(n_cond)]
    for k in ("imperative", "question", "possession", "inverse"):
        rows += [{"kind": k, "i": i} for i in range(n_rest // 4)]
    return rows


def test_cap_holds_when_supply_allows():
    # 5 kinds, cap 25% → caps supply 125% of n; the cap binds cond to 25%
    rows = _skewed()
    sample, manifest = stratified_sample(rows, 1000, cap_fraction=0.25, seed=42)
    assert len(sample) == 1000
    kind, share = top_kind_share(sample)
    # uniform sampling would keep cond at ~54%; the cap holds it at 25%
    assert share <= 0.25 + 1e-9
    assert manifest["per_kind"]["cond"]["kept"] <= manifest["cap_rows"]
    assert sum(v["kept"] for v in manifest["per_kind"].values()) == 1000


def test_unsatisfiable_cap_refuses_with_arithmetic():
    # 5 kinds × 15% supplies only 75% of n — refilling would re-inflate the
    # dominant kind, so the default refuses and shows the numbers
    rows = _skewed()
    with pytest.raises(StrataError) as e:
        stratified_sample(rows, 1000, cap_fraction=0.15, seed=42)
    msg = str(e.value)
    assert "750 of the requested 1000" in msg and "strict_cap=False" in msg


def test_deliberate_refill_is_recorded():
    rows = _skewed()
    sample, manifest = stratified_sample(rows, 1000, cap_fraction=0.15, seed=42,
                                         strict_cap=False)
    assert len(sample) == 1000
    assert manifest["cap_refill_rows"] == 250  # the violation is a number, not a vibe


def test_uniform_sample_would_have_kept_the_skew():
    rows = _skewed()
    _, share = top_kind_share(rows)
    assert share == pytest.approx(0.54, abs=0.01)  # the mistake being guarded


def test_deterministic_under_seed():
    rows = _skewed(540, 460)
    a, _ = stratified_sample(rows, 200, cap_fraction=0.25, seed=7)
    b, _ = stratified_sample(rows, 200, cap_fraction=0.25, seed=7)
    assert [r["i"] for r in a] == [r["i"] for r in b]
    c, _ = stratified_sample(rows, 200, cap_fraction=0.25, seed=8)
    assert [r["i"] for r in a] != [r["i"] for r in c]


def test_small_corpus_returned_whole():
    rows = [{"kind": "a", "i": i} for i in range(5)]
    sample, manifest = stratified_sample(rows, 100, cap_fraction=0.5, seed=1)
    assert len(sample) == 5
    assert manifest["total_seen"] == 5


def test_manifest_accounts_per_kind():
    rows = _skewed(200, 200)
    _, manifest = stratified_sample(rows, 100, cap_fraction=0.2, seed=3)
    assert manifest["per_kind"]["cond"]["seen"] == 200
    assert manifest["guard"] == "sample-strata"
    assert manifest["seed"] == 3


def test_bad_params_refused():
    rows = [{"kind": "a"}]
    with pytest.raises(StrataError):
        stratified_sample(rows, 10, cap_fraction=0.0, seed=1)
    with pytest.raises(StrataError):
        stratified_sample(rows, 10, cap_fraction=1.5, seed=1)
    with pytest.raises(StrataError):
        stratified_sample(rows, 0, seed=1)
