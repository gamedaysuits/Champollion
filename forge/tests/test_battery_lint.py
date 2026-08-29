"""battery-lint golden tests — the crk attempt-3 battery shape must yield
the known diagnoses (assert on rule ids, never prose)."""
from nmt_forge.guards.battery_lint import LintConfig, lint_battery, render_diagnosis


def _g(n, chrf, lo, hi, cov=None, inc=None, mixed=None):
    scores = {"chrf++": {"score": chrf, "ci_lower": lo, "ci_upper": hi}}
    if cov is not None:
        scores["gloss_coverage"] = {"score": cov, "ci_lower": cov, "ci_upper": cov}
    if inc is not None:
        scores["incomplete_at_0_5"] = {"score": inc, "ci_lower": inc, "ci_upper": inc}
    if mixed is not None:
        scores["mixed_convention_rate"] = {"score": mixed, "ci_lower": mixed,
                                           "ci_upper": mixed}
    return {"n": n, "scores": scores}


def _g_plugin(n, chrf, lo, hi, cov, inc):
    """A group shaped like a REAL forge battery: coverage/incomplete arrive as
    referee plugin_aggregates, not top-level scores (the crk pack shape)."""
    return {"n": n,
            "scores": {"chrf++": {"score": chrf, "ci_lower": lo, "ci_upper": hi}},
            "plugin_aggregates": {
                "crk_coverage": {"gloss_coverage": cov,
                                 "incomplete_at_0_5": inc, "measured_count": n}}}


def crk_like_manifest():
    """Shaped like the crk attempt-3 battery (values from the real table)."""
    return {
        "guard": "ci-scoring/battery",
        "eval_set": "e15-battery",
        "by": "register",
        "n": 659,
        "groups": {
            # coverage .024, incomplete .978 → vocabulary gap
            "government": _g(98, 11.4, 10.6, 12.3, cov=0.024, inc=0.978),
            # coverage .38 (has words), incomplete .74 → structure gap
            "scholarly": _g(127, 23.7, 21.0, 26.8, cov=0.38, inc=0.74),
            # wide CI (12.6–18.6 ≈ 6) but under the 8 threshold; bump for test
            "children": _g(53, 15.4, 10.0, 19.5, cov=0.2, inc=0.5),
            # mixed convention present
            "social-media": _g(68, 16.1, 14.9, 17.3, cov=0.2, inc=0.5, mixed=0.03),
            "textbook-test": _g(150, 36.0, 33.1, 38.9, cov=0.28, inc=0.71),
        },
        "strict_groups": {
            # full 36.0 vs strict 30.6 → optimism bound (gap 5.4 > 3)
            "textbook-test": _g(113, 30.6, 27.4, 33.8),
        },
        "near_dupe": {"flagged": 37, "params": {"jaccard_threshold": 0.6}},
        "weighted": {"chrf++": 21.9},
        "notes": {"comet": "model not installed (pip install unbabel-comet)"},
    }


def _rules_for(findings, group):
    return {f.rule for f in findings if f.group == group}


def test_crk_shapes_yield_known_diagnoses():
    findings = lint_battery(crk_like_manifest())
    assert "R1-vocabulary-gap" in _rules_for(findings, "government")
    assert "R2-structure-gap" in _rules_for(findings, "scholarly")
    assert "R3-mixed-convention" in _rules_for(findings, "social-media")
    assert "R4-optimism-bound" in _rules_for(findings, "textbook-test")
    assert "R5-low-power" in _rules_for(findings, "children")
    assert any(f.rule == "R6-referee-unavailable" for f in findings)
    weakest = next(f for f in findings if f.rule == "R8-weakest-registers")
    assert "government" in weakest.evidence["weakest"]


def test_transfer_plateau_from_run_manifest():
    run_manifest = {"stop_explanation":
                    "early stop suppressed by floor; dev plateaued at step 10k "
                    "while train loss kept falling"}
    findings = lint_battery(crk_like_manifest(), run_manifest=run_manifest)
    assert any(f.rule == "R7-transfer-plateau" for f in findings)


def test_coverage_rules_fire_from_plugin_aggregates():
    # the real forge battery emits coverage/incomplete under plugin_aggregates,
    # NOT top-level scores — the lint must still fire R1/R2 (dogfood 2026-07-14,
    # the crk v7-forge evaluate run under-diagnosed until this was fixed)
    m = {"guard": "ci-scoring/battery", "eval_set": "e15-battery",
         "by": "register", "n": 151,
         "groups": {
             "government": _g_plugin(98, 8.95, 8.0, 9.9, cov=0.02, inc=0.978),
             "scholarly": _g_plugin(53, 25.0, 21.3, 28.7, cov=0.38, inc=0.72)}}
    findings = lint_battery(m)
    assert "R1-vocabulary-gap" in _rules_for(findings, "government")
    assert "R2-structure-gap" in _rules_for(findings, "scholarly")


def test_transfer_plateau_detected_from_dev_loss_trajectory():
    # no 'plateau' keyword anywhere — the signal is the trajectory: dev loss
    # bottoms at step 4000, then rises. Shaped exactly like the crk v7-forge run.
    run_manifest = {"stages": [{"stage": "train",
        "stop_explanation": "early stopping fired at step 16,000 (floor 8,651 "
                            "already passed; patience 6).",
        "checkpoints": [
            {"id": "checkpoint-2000", "step": 2000, "dev_loss": 3.88},
            {"id": "checkpoint-4000", "step": 4000, "dev_loss": 3.77},
            {"id": "checkpoint-6000", "step": 6000, "dev_loss": 3.98},
            {"id": "checkpoint-8000", "step": 8000, "dev_loss": 4.03},
            {"id": "checkpoint-16000", "step": 16000, "dev_loss": 4.31}]}]}
    findings = lint_battery(crk_like_manifest(), run_manifest=run_manifest)
    r7 = next(f for f in findings if f.rule == "R7-transfer-plateau")
    assert r7.evidence["min_at"] == "step 4,000"
    assert r7.evidence["final_dev_loss"] == 4.31


def test_no_plateau_when_dev_loss_still_improving():
    run_manifest = {"stages": [{"checkpoints": [
        {"id": "c1", "step": 2000, "dev_loss": 4.0},
        {"id": "c2", "step": 4000, "dev_loss": 3.5},
        {"id": "c3", "step": 6000, "dev_loss": 3.2}]}]}
    findings = lint_battery(crk_like_manifest(), run_manifest=run_manifest)
    assert not any(f.rule == "R7-transfer-plateau" for f in findings)


def test_healthy_battery_yields_no_high_findings():
    m = {
        "guard": "ci-scoring/battery", "eval_set": "x", "by": "register",
        "n": 400,
        "groups": {"a": _g(200, 55.0, 54.0, 56.0, cov=0.6, inc=0.2),
                   "b": _g(200, 52.0, 51.0, 53.0, cov=0.5, inc=0.3)},
        "strict_groups": {}, "near_dupe": {}, "weighted": {}, "notes": {},
    }
    findings = lint_battery(m)
    assert not [f for f in findings if f.severity == "high"]


def test_render_is_plain_language():
    out = render_diagnosis(lint_battery(crk_like_manifest()))
    assert "Diagnosis" in out and "R1-vocabulary-gap" in out


def test_thresholds_overridable():
    cfg = LintConfig(ci_width_wide=100.0)   # nothing is "wide" now
    findings = lint_battery(crk_like_manifest(), config=cfg)
    assert not any(f.rule == "R5-low-power" for f in findings)
