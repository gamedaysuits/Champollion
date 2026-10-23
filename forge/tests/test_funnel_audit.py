import pytest

from nmt_forge.errors import FunnelRegression
from nmt_forge.guards.funnel_audit import Funnel, canon_recoverable

STAGES = ["loaded", "canonicalized", "parsed", "emitted"]


def test_report_shape_and_losses():
    f = Funnel("dict→emitted", STAGES)
    f.tick("loaded", 100)
    f.tick("canonicalized", 100)
    f.tick("parsed", 80)
    f.drop("parsed", "gloss_shape", n=20)
    f.tick("emitted", 60)
    f.drop("emitted", "gen_fail", n=20)
    rep = f.report()
    stages = {r["stage"]: r for r in rep["stages"]}
    assert stages["parsed"]["lost_from_previous"] == 20
    assert stages["parsed"]["drop_reasons"] == {"gloss_shape": 20}
    assert stages["emitted"]["count"] == 60


def test_assert_max_drop_budget():
    f = Funnel("x", STAGES)
    f.tick("loaded", 100)
    f.tick("canonicalized", 90)
    f.assert_max_drop("loaded", "canonicalized", 0.15)  # 10% < 15%: fine
    with pytest.raises(FunnelRegression) as e:
        f.assert_max_drop("loaded", "canonicalized", 0.05)
    assert "budget" in str(e.value)


def test_empty_upstream_is_its_own_error():
    f = Funnel("x", STAGES)
    with pytest.raises(FunnelRegression, match="0 items"):
        f.assert_max_drop("loaded", "canonicalized", 0.5)


def test_canon_recoverable_is_the_y_bug_detector():
    # the analyzer accepts 'y' spellings; the dictionary uses 'ý'
    known = {"pimipayiw", "nipaw"}
    accept = lambda w: w in known
    canon = lambda w: w.replace("ý", "y")
    dropped = ["pimipaýiw", "blartok", "nipaw"]  # last one: canon==raw, skip
    rec = canon_recoverable(dropped, accept, canon)
    assert rec == ["pimipaýiw"]


def test_funnel_assert_none_recoverable_raises_with_boundary_fix():
    f = Funnel("dict→emitted", STAGES)
    f.tick("loaded", 3)
    f.drop("parsed", "unknown_lemma", item="pimipaýiw")
    f.drop("parsed", "unknown_lemma", item="blartok")
    accept = lambda w: w == "pimipayiw"
    canon = lambda w: w.replace("ý", "y")
    assert f.canon_recoverable(accept, canon) == ["pimipaýiw"]
    with pytest.raises(FunnelRegression) as e:
        f.assert_none_recoverable(accept, canon)
    msg = str(e.value)
    assert "ADAPTER BOUNDARY" in msg and "1,375" in msg


def test_unknown_stage_rejected():
    f = Funnel("x", STAGES)
    with pytest.raises(ValueError, match="unknown stage"):
        f.tick("nonsense")
    with pytest.raises(ValueError, match="unknown stage"):
        f.drop("nonsense", "r")
